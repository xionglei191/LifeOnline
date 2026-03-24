import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("kotlin-kapt")
}

val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) load(f.inputStream())
}

android {
    namespace = "com.lingguang.catcher"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.lingguang.catcher"
        minSdk = 26
        targetSdk = 34
        versionCode = 54
        versionName = "1.54"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "DASHSCOPE_API_KEY", "\"${localProps["DASHSCOPE_API_KEY"] ?: ""}\"")
        buildConfigField("String", "OPENAI_API_KEY", "\"${localProps["OPENAI_API_KEY"] ?: ""}\"")
        buildConfigField("String", "GEMINI_API_KEY", "\"${localProps["GEMINI_API_KEY"] ?: ""}\"")
        buildConfigField("String", "R2_ACCOUNT_ID", "\"${localProps["R2_ACCOUNT_ID"] ?: ""}\"")
        buildConfigField("String", "R2_ACCESS_KEY_ID", "\"${localProps["R2_ACCESS_KEY_ID"] ?: ""}\"")
        buildConfigField("String", "R2_SECRET_ACCESS_KEY", "\"${localProps["R2_SECRET_ACCESS_KEY"] ?: ""}\"")
        buildConfigField("String", "R2_BUCKET_NAME", "\"${localProps["R2_BUCKET_NAME"] ?: ""}\"")
        buildConfigField("String", "R2_PUBLIC_DOMAIN", "\"${localProps["R2_PUBLIC_DOMAIN"] ?: ""}\"")
    }

    signingConfigs {
        create("release") {
            storeFile = file("release.keystore")
            storePassword = "lifeonline"
            keyAlias = "release"
            keyPassword = "lifeonline"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
}

dependencies {
    // AndroidX Core
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")

    // Lifecycle & ViewModel
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0")

    // WorkManager for background tasks
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // Networking - OkHttp & Retrofit
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")

    // JSON parsing
    implementation("com.google.code.gson:gson:2.10.1")

    // HTML parsing
    implementation("org.jsoup:jsoup:1.17.2")

    // CameraX
    implementation("androidx.camera:camera-core:1.3.1")
    implementation("androidx.camera:camera-camera2:1.3.1")
    implementation("androidx.camera:camera-lifecycle:1.3.1")
    implementation("androidx.camera:camera-view:1.3.1")

    // EXIF 方向读取
    implementation("androidx.exifinterface:exifinterface:1.3.7")

    // Room Database
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")

    // AWS SDK for S3 (compatible with R2)
    implementation("com.amazonaws:aws-android-sdk-s3:2.77.0")
    implementation("com.amazonaws:aws-android-sdk-core:2.77.0")

    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}
