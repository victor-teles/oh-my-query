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
