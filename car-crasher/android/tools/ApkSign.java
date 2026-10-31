import com.android.apksig.ApkSigner;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/** Signs an APK (APK Signature Scheme v2) with apksig. Args: keystore storepass alias in.apk out.apk */
public class ApkSign {
    public static void main(String[] a) throws Exception {
        if (a.length != 5) throw new IllegalArgumentException("usage: ApkSign keystore storepass alias in.apk out.apk");
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (InputStream in = new FileInputStream(a[0])) { ks.load(in, a[1].toCharArray()); }
        PrivateKey key = (PrivateKey) ks.getKey(a[2], a[1].toCharArray());
        X509Certificate cert = (X509Certificate) ks.getCertificate(a[2]);
        ApkSigner.SignerConfig signer = new ApkSigner.SignerConfig.Builder("JC", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(signer))
                .setInputApk(new File(a[3]))
                .setOutputApk(new File(a[4]))
                .setMinSdkVersion(24)
                .setV1SigningEnabled(false) // minSdk 24 verifies the v2 scheme; v1 is only for Android 6 and older
                .setV2SigningEnabled(true)
                .build()
                .sign();
        System.out.println("signed " + a[4]);
    }
}
