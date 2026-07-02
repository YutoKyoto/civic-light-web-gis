import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { downloadBlob } from "./project";

export async function exportMapPng(element: HTMLElement, filename = "web-gis-map.png") {
  const canvas = await html2canvas(element, {
    useCORS: true,
    backgroundColor: "#ffffff"
  });
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(filename, blob);
  }, "image/png");
}

export async function exportMapPdf(element: HTMLElement, filename = "web-gis-map.pdf") {
  const canvas = await html2canvas(element, {
    useCORS: true,
    backgroundColor: "#ffffff"
  });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width, canvas.height]
  });
  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save(filename);
}
