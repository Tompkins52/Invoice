package com.tompkinssoftwaresystems.billhead;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/** Opens the phone's email app with the invoice PDF attached and the address, subject and message filled in.
 *  The person presses Send there, from their own account; nothing goes through a server of ours. */
@CapacitorPlugin(name = "BillheadMail")
public class MailPlugin extends Plugin {

    @PluginMethod
    public void send(PluginCall call) {
        String to = call.getString("to", "");
        String subject = call.getString("subject", "");
        String body = call.getString("body", "");
        String fileUri = call.getString("file", "");
        String name = call.getString("name", "invoice.pdf");
        try {
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("message/rfc822");
            if (to != null && !to.isEmpty()) intent.putExtra(Intent.EXTRA_EMAIL, new String[] { to });
            intent.putExtra(Intent.EXTRA_SUBJECT, subject);
            intent.putExtra(Intent.EXTRA_TEXT, body);
            if (fileUri != null && !fileUri.isEmpty()) {
                File file = new File(Uri.parse(fileUri).getPath());
                Uri content = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
                intent.putExtra(Intent.EXTRA_STREAM, content);
                intent.setClipData(ClipData.newRawUri(name, content));
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }
            Intent chooser = Intent.createChooser(intent, "Send " + name);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(chooser);
            call.resolve(new JSObject());
        } catch (Exception e) {
            call.reject("No email app could take it: " + e.getMessage(), e);
        }
    }
}
