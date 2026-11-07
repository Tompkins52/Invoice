package com.tompkinssoftwaresystems.billhead;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MailPlugin.class);
        super.onCreate(savedInstanceState);
        // After super.onCreate: Capacitor has switched from the launch theme to the no-action-bar theme by then.
        // (Touching the window before that creates it under the launch theme, which carries a title bar.)
        // The app draws under the system bars; the web app pads its header and tab bar with the safe-area insets.
        EdgeToEdge.enable(this);
    }
}
