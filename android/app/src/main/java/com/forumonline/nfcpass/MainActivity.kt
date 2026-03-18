package com.forumonline.nfcpass

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "ForumFeedApp"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    // Keep app in foreground when Android back gesture/button reaches activity default handler.
    // In-app navigation is handled in JS (NavigationContext + BackHandler).
    override fun invokeDefaultOnBackPressed() {
        // no-op
    }
}
