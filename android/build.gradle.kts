// Top-level build file where you can add configuration options common to all sub-projects/modules.

import org.gradle.api.tasks.Delete
import org.gradle.api.file.Directory

// Set NDK version
val ndkVersion = "25.1.8937393"

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// Optional: define NDK version in all subprojects that apply the Android plugin
subprojects {
    afterEvaluate {
        if (plugins.hasPlugin("com.android.application") || plugins.hasPlugin("com.android.library")) {
            extensions.configure<com.android.build.gradle.BaseExtension> {
                this.ndkVersion = ndkVersion
            }
        }
    }
}

// Redirect global build directory to "../../build"
val newBuildDir: Directory = rootProject.layout.buildDirectory.dir("../../build").get()
rootProject.layout.buildDirectory.value(newBuildDir)

// Redirect each subproject’s build dir to subfolder of the shared build dir
subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}

// Ensure all subprojects evaluate after `:app`
subprojects {
    project.evaluationDependsOn(":app")
}

// Custom clean task
tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
