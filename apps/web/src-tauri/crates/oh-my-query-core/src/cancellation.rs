use std::collections::HashMap;
use std::sync::Mutex;

use tokio::sync::oneshot;

pub struct CancellationRegistry {
    inner: Mutex<HashMap<String, oneshot::Sender<()>>>,
}

impl CancellationRegistry {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }

    pub fn register(&self, query_id: String) -> oneshot::Receiver<()> {
        let (tx, rx) = oneshot::channel();
        let mut map = self.inner.lock().expect("cancellation registry poisoned");
        map.insert(query_id, tx);
        rx
    }

    pub fn remove(&self, query_id: &str) {
        let mut map = self.inner.lock().expect("cancellation registry poisoned");
        map.remove(query_id);
    }

    pub fn cancel(&self, query_id: &str) -> bool {
        let sender = {
            let mut map = self.inner.lock().expect("cancellation registry poisoned");
            map.remove(query_id)
        };
        if let Some(sender) = sender {
            sender.send(()).is_ok()
        } else {
            false
        }
    }
}

impl Default for CancellationRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn register_returns_a_pending_receiver() {
        let registry = CancellationRegistry::new();
        let mut rx = registry.register("q-1".into());
        assert!(rx.try_recv().is_err());
    }

    #[tokio::test]
    async fn cancel_fires_the_receiver_and_returns_true() {
        let registry = CancellationRegistry::new();
        let rx = registry.register("q-1".into());

        assert!(registry.cancel("q-1"));
        assert_eq!(rx.await, Ok(()));
    }

    #[test]
    fn cancel_unknown_id_returns_false() {
        let registry = CancellationRegistry::new();
        assert!(!registry.cancel("missing"));
    }

    #[tokio::test]
    async fn remove_drops_the_sender_without_firing() {
        let registry = CancellationRegistry::new();
        let mut rx = registry.register("q-1".into());

        registry.remove("q-1");
        assert!(!registry.cancel("q-1"));
        assert!(rx.try_recv().is_err());
    }

    #[test]
    fn default_constructs_an_empty_registry() {
        let registry = CancellationRegistry::default();
        assert!(!registry.cancel("anything"));
    }

    #[tokio::test]
    async fn multiple_ids_are_independent() {
        let registry = std::sync::Arc::new(CancellationRegistry::new());
        let rx_a = registry.register("a".into());
        let rx_b = registry.register("b".into());

        assert!(registry.cancel("a"));
        assert_eq!(rx_a.await, Ok(()));

        assert!(registry.cancel("b"));
        assert_eq!(rx_b.await, Ok(()));
    }

    #[tokio::test]
    async fn re_registering_same_id_replaces_the_previous_sender() {
        let registry = CancellationRegistry::new();
        let mut rx_first = registry.register("q-1".into());
        let rx_second = registry.register("q-1".into());

        assert!(registry.cancel("q-1"));
        assert_eq!(rx_second.await, Ok(()));
        // The first receiver is dropped — its sender was replaced and never fired.
        assert!(rx_first.try_recv().is_err());
    }
}
