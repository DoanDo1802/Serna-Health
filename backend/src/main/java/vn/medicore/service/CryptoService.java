package vn.medicore.service;

public interface CryptoService {

    String encrypt(String plaintext, String context);

    String decrypt(String ciphertext, String context);

    String comparisonToken(String identifierType, String issuer, String jurisdiction, String value);

    NormalizedIdentifier normalize(String identifierType, String issuer, String jurisdiction, String value);

    record NormalizedIdentifier(
            String identifierType,
            String issuer,
            String jurisdiction,
            String value,
            String displaySuffix) {
    }
}
