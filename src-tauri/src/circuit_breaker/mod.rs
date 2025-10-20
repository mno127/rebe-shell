/// Circuit Breaker Pattern
///
/// Prevents cascading failures by detecting repeated errors and "opening" the circuit
/// to fail fast instead of wasting resources on operations that will fail.

use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

#[derive(Debug, Clone)]
pub struct CircuitBreakerConfig {
    pub failure_threshold: usize,
    pub success_threshold: usize,
    pub timeout: Duration,
}

impl Default for CircuitBreakerConfig {
    fn default() -> Self {
        Self {
            failure_threshold: 5,
            success_threshold: 2,
            timeout: Duration::from_secs(60),
        }
    }
}

#[derive(Debug, Clone)]
enum BreakerState {
    Closed { failures: usize },
    Open { opened_at: Instant },
    HalfOpen { successes: usize },
}

pub struct CircuitBreaker {
    state: Arc<Mutex<BreakerState>>,
    config: CircuitBreakerConfig,
}

impl CircuitBreaker {
    pub fn new(config: CircuitBreakerConfig) -> Self {
        Self {
            state: Arc::new(Mutex::new(BreakerState::Closed { failures: 0 })),
            config,
        }
    }

    /// Execute operation with circuit breaker protection
    pub async fn call<F, T, E>(&self, operation: F) -> Result<T, CircuitBreakerError<E>>
    where
        F: std::future::Future<Output = Result<T, E>>,
    {
        // Check state before attempting operation
        {
            let mut state = self.state.lock().await;

            match *state {
                BreakerState::Open { opened_at } => {
                    if opened_at.elapsed() > self.config.timeout {
                        // Transition to half-open
                        *state = BreakerState::HalfOpen { successes: 0 };
                        tracing::info!("Circuit breaker transitioning to half-open");
                    } else {
                        return Err(CircuitBreakerError::Open);
                    }
                }
                _ => {}
            }
        }

        // Execute operation
        let result = operation.await;

        // Update state based on result
        let mut state = self.state.lock().await;

        match result {
            Ok(value) => {
                *state = match *state {
                    BreakerState::HalfOpen { successes } => {
                        if successes + 1 >= self.config.success_threshold {
                            tracing::info!("Circuit breaker closing (recovered)");
                            BreakerState::Closed { failures: 0 }
                        } else {
                            BreakerState::HalfOpen {
                                successes: successes + 1,
                            }
                        }
                    }
                    _ => BreakerState::Closed { failures: 0 },
                };

                Ok(value)
            }
            Err(e) => {
                *state = match *state {
                    BreakerState::Closed { failures } => {
                        if failures + 1 >= self.config.failure_threshold {
                            tracing::warn!("Circuit breaker opening (too many failures)");
                            BreakerState::Open {
                                opened_at: Instant::now(),
                            }
                        } else {
                            BreakerState::Closed {
                                failures: failures + 1,
                            }
                        }
                    }
                    BreakerState::HalfOpen { .. } => {
                        tracing::warn!("Circuit breaker re-opening (failure during recovery)");
                        BreakerState::Open {
                            opened_at: Instant::now(),
                        }
                    }
                    s => s,
                };

                Err(CircuitBreakerError::OperationFailed(e))
            }
        }
    }

    /// Get current state (for monitoring)
    pub async fn is_open(&self) -> bool {
        matches!(*self.state.lock().await, BreakerState::Open { .. })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum CircuitBreakerError<E> {
    #[error("Circuit breaker is open (too many failures)")]
    Open,

    #[error("Operation failed: {0}")]
    OperationFailed(E),
}

impl Clone for CircuitBreaker {
    fn clone(&self) -> Self {
        Self {
            state: Arc::clone(&self.state),
            config: self.config.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_circuit_breaker_opens_after_failures() {
        let breaker = CircuitBreaker::new(CircuitBreakerConfig {
            failure_threshold: 3,
            success_threshold: 2,
            timeout: Duration::from_secs(60),
        });

        // Succeed a few times
        for _ in 0..2 {
            let result = breaker.call(async { Ok::<_, ()>(()) }).await;
            assert!(result.is_ok());
        }

        // Fail repeatedly
        for _ in 0..3 {
            let result = breaker.call(async { Err::<(), _>("error") }).await;
            assert!(matches!(
                result,
                Err(CircuitBreakerError::OperationFailed(_))
            ));
        }

        // Circuit should now be open
        assert!(breaker.is_open().await);

        // Next call should fail immediately
        let result = breaker.call(async { Ok::<_, ()>(()) }).await;
        assert!(matches!(result, Err(CircuitBreakerError::Open)));
    }

    #[tokio::test]
    async fn test_circuit_breaker_recovers() {
        let breaker = CircuitBreaker::new(CircuitBreakerConfig {
            failure_threshold: 2,
            success_threshold: 2,
            timeout: Duration::from_millis(100),
        });

        // Open the circuit
        for _ in 0..2 {
            let _ = breaker.call(async { Err::<(), _>("error") }).await;
        }

        assert!(breaker.is_open().await);

        // Wait for timeout
        tokio::time::sleep(Duration::from_millis(150)).await;

        // Should be half-open now, allow operations
        for _ in 0..2 {
            let result = breaker.call(async { Ok::<_, ()>(()) }).await;
            assert!(result.is_ok());
        }

        // Should be closed now
        assert!(!breaker.is_open().await);
    }
}
