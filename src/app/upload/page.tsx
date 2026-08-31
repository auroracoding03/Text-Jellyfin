import { UploadForm } from "@/components/UploadForm";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function UploadPage() {
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

      <UploadForm
        maxUploadBytes={config.maxUploadBytes}
        maxNoteImages={config.maxNoteImages}
        maxNoteImageBytes={config.maxNoteImageBytes}
      />
    </main>
  );
}
