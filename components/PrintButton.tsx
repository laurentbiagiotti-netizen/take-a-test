"use client";
export default function PrintButton({ label = "Imprimer ou enregistrer en PDF" }: { label?: string }) {
  return <button className="btn-secondary" onClick={() => window.print()}>{label}</button>;
}
