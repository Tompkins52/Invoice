package com.tompkinssoftwaresystems.billhead;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app draws under the system bars; the web app pads its header and tab bar with the safe-area insets.
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
