use app_lib::crypto::{decrypt_with_key, encrypt_with_key};
use codspeed_criterion_compat::{black_box, criterion_group, criterion_main, Criterion};

const TEST_KEY: [u8; 32] = [0x42; 32];

const SMALL_PLAINTEXT: &str = r#"{"id":"hist_01HY9N7GK8ZQX0YFD2EPR4M5VT","created_at":"2026-04-24T14:23:11.842Z","connection_id":"conn_local_pg","sql":"select id, email, created_at from users where tenant_id = $1 order by created_at desc limit 50","duration_ms":12,"status":"ok","row_count":50}"#;

fn large_plaintext() -> String {
    let row = r#"{"id":123456,"email":"user@example.com","display_name":"Jane Doe","created_at":"2026-01-01T00:00:00Z","last_login":"2026-04-24T10:15:00Z","tenant_id":"acme","flags":42,"notes":"lorem ipsum dolor sit amet, consectetur adipiscing elit"}"#;
    let mut buf = String::with_capacity(64 * 1024);
    while buf.len() < 64 * 1024 {
        buf.push_str(row);
        buf.push('\n');
    }
    buf
}

fn bench_encrypt(c: &mut Criterion) {
    let large = large_plaintext();

    c.bench_function("encrypt_small", |b| {
        b.iter(|| encrypt_with_key(black_box(&TEST_KEY), black_box(SMALL_PLAINTEXT)).unwrap());
    });

    c.bench_function("encrypt_large", |b| {
        b.iter(|| encrypt_with_key(black_box(&TEST_KEY), black_box(&large)).unwrap());
    });
}

fn bench_decrypt(c: &mut Criterion) {
    let large = large_plaintext();
    let small_ct = encrypt_with_key(&TEST_KEY, SMALL_PLAINTEXT).unwrap();
    let large_ct = encrypt_with_key(&TEST_KEY, &large).unwrap();

    c.bench_function("decrypt_small", |b| {
        b.iter(|| decrypt_with_key(black_box(&TEST_KEY), black_box(&small_ct)).unwrap());
    });

    c.bench_function("decrypt_large", |b| {
        b.iter(|| decrypt_with_key(black_box(&TEST_KEY), black_box(&large_ct)).unwrap());
    });
}

criterion_group!(benches, bench_encrypt, bench_decrypt);
criterion_main!(benches);
