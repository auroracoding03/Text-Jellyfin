import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteDocumentButton } from "@/components/DeleteDocumentButton";
import { DocumentContentForm } from "@/components/DocumentContentForm";
import { MetadataForm } from "@/components/MetadataForm";
import { canEditContent, readEditableSource } from "@/lib/catalog/content-actions";
import { getDocumentById } from "@/lib/catalog/queries";

export const dynamic = "force-dynamic";

export default async function EditRecordPage({
  params,
}: {
  params: { id: string };
}) {
  const document = getDocumentById(params.id);
  if (!document) notFound();
  const editableNote = canEditContent(document);

  return (
    <main>
      <section className="hero">
        <h1>{editableNote ? "Edit note" : "Edit record"}</h1>
        <p>
          {editableNote
            ? "Update the pasted note text and catalog details. Metadata is stored in a sidecar next to the note."
            : "Update the catalog details for this article. Metadata is written to a sidecar YAML file next to the source. The original file stays unchanged."}
        </p>
        <div className="nav">
          <Link className="button" href={`/works/${document.id}`}>
            Cancel
          </Link>
          <DeleteDocumentButton id={document.id} title={document.title} />
        </div>
      </section>
      <MetadataForm
        id={document.id}
        initial={{
          title: document.title,
          summary: document.summary,
          author: document.author || "",
          series: document.series || "",
          language: document.language || "",
          tags: document.tags.join(", "),
        }}
      />
      {editableNote ? (
        <section className="record-editor-section" id="note-text">
          <h2>Note text</h2>
          <p>
            Edit the pasted {document.format === "md" ? "Markdown" : "plain-text"} note.
            Your changes will be re-indexed when saved.
          </p>
          <DocumentContentForm
            id={document.id}
            initialContent={readEditableSource(document.id)}
            format={document.format}
          />
        </section>
      ) : (
        <section className="panel record-editor-section">
          <h2>Source text</h2>
          <p>
            This {document.format.toUpperCase()} file is indexed as a read-only source.
            You can still update its title, teaser, and tags above, or delete it from the
            library.
          </p>
        </section>
      )}
    </main>
  );
}
