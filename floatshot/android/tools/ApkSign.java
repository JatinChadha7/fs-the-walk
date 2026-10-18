import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/** Signs an APK (APK Signature Scheme v2) with apksig, then verifies it. Args: keystore storepass alias in.apk out.apk */
public class ApkSign {
    public static void main(String[] a) throws Exception {
        if (a.length != 5) throw new IllegalArgumentException("usage: ApkSign keystore storepass alias in.apk out.apk");
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (InputStream in = new FileInputStream(a[0])) { ks.load(in, a[1].toCharArray()); }
        PrivateKey key = (PrivateKey) ks.getKey(a[2], a[1].toCharArray());
        X509Certificate cert = (X509Certificate) ks.getCertificate(a[2]);
        ApkSigner.SignerConfig signer = new ApkSigner.SignerConfig.Builder("FloatShot", key, Collections.singletonList(cert)).build();
        File out = new File(a[4]);
        new ApkSigner.Builder(Collections.singletonList(signer))
                .setInputApk(new File(a[3]))
                .setOutputApk(out)
                .setMinSdkVersion(30)
                .setV1SigningEnabled(false) // minSdk 30 verifies the v2 scheme; v1 is only for Android 6 and older
                .setV2SigningEnabled(true)
                .build()
                .sign();
        ApkVerifier.Result result = new ApkVerifier.Builder(out).build().verify();
        if (!result.isVerified()) {
            System.err.println("signature does not verify: " + result.getErrors());
            System.exit(1);
        }
        System.out.println("signed and verified " + a[4]);
    }
}
