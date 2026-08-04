import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentContentForm } from "@/components/DocumentContentForm";
import { MetadataForm } from "@/components/MetadataForm";
import { canEditSource, readEditableSource } from "@/lib/catalog/content-actions";
import { getDocumentById } from "@/lib/catalog/queries";

export const dynamic = "force-dynamic";

export default async function EditRecordPage({
  params,
}: {
  params: { id: string };
}) {
  const document = getDocumentById(params.id);
  if (!document) notFound();

  return (
    <main>
      <section className="hero">
        <h1>Edit record</h1>
        <p>
          Update the catalog details for this article. Metadata is written to a
          sidecar YAML file next to the source.
        </p>
        <Link className="button" href={`/works/${document.id}`}>
          Cancel
        </Link>
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
      {canEditSource(document.format) ? (
        <section className="record-editor-section">
          <h2>Source text</h2>
          <p>
            Edit the original {document.format === "md" ? "Markdown" : "plain-text"} file.
            Your changes will be re-indexed when saved.
          </p>
          <DocumentContentForm
            id={document.id}
            initialContent={readEditableSource(document.id)}
          />
        </section>
      ) : (
        <section className="panel record-editor-section">
          <h2>Source text</h2>
          <p>
            This {document.format.toUpperCase()} source stays unchanged here. You can still
            update its title, teaser, and tags above.
          </p>
        </section>
      )}
    </main>
  );
}
