import Link from "next/link";
import { notFound } from "next/navigation";
import { MetadataForm } from "@/components/MetadataForm";
import { getDocumentById } from "@/lib/catalog/queries";

export const dynamic = "force-dynamic";

export default async function EditMetadataPage({
  params,
}: {
  params: { id: string };
}) {
  const document = getDocumentById(params.id);
  if (!document) notFound();

  return (
    <main>
      <section className="hero">
        <h1>Edit metadata</h1>
        <p>
          Changes are written to a sidecar YAML file next to the source. The
          original document is never rewritten.
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
    </main>
  );
}
