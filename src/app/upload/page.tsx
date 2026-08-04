import { UploadForm } from "@/components/UploadForm";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function UploadPage() {
  const enabled = config.authEnabled;

  return (
    <main>
      <section className="hero">
        <h1>Add writing from anywhere.</h1>
        <p>
          Send a Markdown or plain-text file from your phone, or paste a note
          directly into your library. Uploads are saved under <code>uploads/</code>
          and indexed immediately.
        </p>
      </section>

      {enabled ? (
        <UploadForm maxUploadBytes={config.maxUploadBytes} />
      ) : (
        <div className="panel upload-notice">
          <h2>Uploads are disabled</h2>
          <p>
            Set <code>AUTH_USERNAME</code> and <code>AUTH_PASSWORD</code> in the
            server environment, then restart Text Jellyfin. The app login protects
            both reading and uploads.
          </p>
        </div>
      )}
    </main>
  );
}
