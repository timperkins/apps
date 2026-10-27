import Link from "next/link";

export default function NotFound() {
  return (
    <div className="narrow article">
      <h1>We couldn&apos;t find that story</h1>
      <p className="dek">It may have expired. Older stories are removed after a few weeks.</p>
      <p>
        <Link href="/" className="btn">
          Back to the front page
        </Link>
      </p>
    </div>
  );
}
