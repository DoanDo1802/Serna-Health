package vn.medicore.service;

public interface CryptoService {

    /**
     * Encrypts a plaintext string and returns a Base64-encoded ciphertext.
     */
    String encrypt(String plaintext);

    /**
     * Decrypts a Base64-encoded ciphertext back to plaintext.
     */
    String decrypt(String ciphertext);

    /**
     * Generates a deterministic hash (e.g. SHA-256) of a value for comparison,
     * returned as a hex string.
     */
    String hashForComparison(String value);
}
