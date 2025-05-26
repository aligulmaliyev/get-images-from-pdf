import { useState } from "react";
import { Upload, Download, Image, FileText, AlertCircle } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface ExtractedImage {
  id: number;
  name: string;
  page: number;
  base64: string;
  format: string;
  width: number;
  height: number;
  source: "embedded" | "page-render";
}

const PDFImageExtractor = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedImages, setExtractedImages] = useState<ExtractedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      setError("");
      setExtractedImages([]);
    } else {
      setError("Zəhmət olmasa PDF fayl seçin");
    }
  };

  const extractImages = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError("");

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      const extractedImages: ExtractedImage[] = [];
      let imageCounter = 0;

      // İlk olaraq PDF-də embedded şəkilləri axtarırıq
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);

        try {
          // Operator listini əldə edirik
          const operatorList = await page.getOperatorList();

          // Image operatorlarını axtarırıq
          for (let i = 0; i < operatorList.fnArray.length; i++) {
            if (operatorList.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
              imageCounter++;

              // Şəkil tapıldığını göstərmək üçün səhifəni render edirik
              const viewport = page.getViewport({ scale: 1.0 });
              const canvas = document.createElement("canvas");
              const context = canvas.getContext("2d");
              canvas.width = viewport.width;
              canvas.height = viewport.height;

              if (!context) {
                console.error("Canvas konteksti əldə edilə bilmədi");
                continue;
              }
              // Səhifəni render edirik
              await page.render({
                canvasContext: context,
                viewport: viewport,
              }).promise;

              const base64 = canvas.toDataURL("image/png", 0.8);
              extractedImages.push({
                id: imageCounter,
                name: `Embedded Şəkil ${imageCounter}`,
                page: pageNum,
                base64: base64,
                format: "PNG",
                width: canvas.width,
                height: canvas.height,
                source: "embedded",
              });
            }
          }
        } catch (pageError) {
          console.warn(`Səhifə ${pageNum} analiz xətası:`, pageError);
        }
      }

      // Əgər embedded şəkil tapılmasa, səhifələri render edirik
      if (extractedImages.length === 0) {
        const maxPages = Math.min(pdf.numPages, 5); // maksimum 5 səhifə

        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.2 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          if (!context) {
            console.error("Canvas konteksti əldə edilə bilmədi");
            continue;
          }
          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          const base64 = canvas.toDataURL("image/png", 0.9);
          extractedImages.push({
            id: pageNum,
            name: `Səhifə ${pageNum}`,
            page: pageNum,
            base64: base64,
            format: "PNG",
            width: canvas.width,
            height: canvas.height,
            source: "page-render",
          });
        }
      }

      setExtractedImages(extractedImages);

      console.log(extractedImages);
      if (extractedImages.length === 0) {
        setError("PDF faylında heç bir məzmun tapılmadı");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("PDF analiz xətası:", errorMessage);
      if (errorMessage.includes("Invalid PDF")) {
        setError("Seçilən fayl düzgün PDF formatında deyil");
      } else if (errorMessage.includes("Password")) {
        setError("Bu PDF şifrələnib, şifrəni daxil edin");
      } else {
        setError("PDF faylını analiz edərkən xəta: " + errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const downloadImage = (image: ExtractedImage) => {
    const link = document.createElement("a");
    link.href = image.base64;
    link.download = `${image.name}.${image.format.toLowerCase()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyBase64 = (base64: string) => {
    navigator.clipboard.writeText(base64);
    alert("Base64 kodu kopyalandı!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <FileText className="w-12 h-12 text-indigo-600 mr-3" />
              <h1 className="text-3xl font-bold text-gray-800">
                PDF Şəkil Çıxarıcı
              </h1>
            </div>
            <p className="text-gray-600">
              PDF faylından şəkilləri çıxarıb base64 formatda əldə edin
            </p>
          </div>

          {/* Fayl Yüklənməsi */}
          <div className="mb-8">
            <div className="border-2 border-dashed border-indigo-300 rounded-xl p-8 text-center hover:border-indigo-500 transition-colors">
              <Upload className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
              <div className="mb-4">
                <label htmlFor="pdf-file" className="cursor-pointer">
                  <span className="text-lg font-medium text-indigo-600 hover:text-indigo-700">
                    PDF fayl seçin
                  </span>
                  <input
                    id="pdf-file"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
              {selectedFile && (
                <div className="bg-indigo-50 rounded-lg p-4 mb-4">
                  <p className="text-indigo-800 font-medium">
                    {selectedFile.name}
                  </p>
                  <p className="text-indigo-600 text-sm">
                    Ölçü: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Xəta Mesajı */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {/* Çıxarma Düyməsi */}
          {selectedFile && (
            <div className="text-center mb-8">
              <button
                onClick={extractImages}
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-8 py-3 rounded-lg font-semibold transition-colors flex items-center mx-auto"
              >
                <Image className="w-5 h-5 mr-2" />
                {isLoading ? "Şəkillər çıxarılır..." : "Şəkilləri Çıxar"}
              </button>
            </div>
          )}

          {/* Yüklənmə Animasiyası */}
          {isLoading && (
            <div className="text-center mb-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-gray-600">PDF analiz edilir...</p>
            </div>
          )}

          {/* Çıxarılan Şəkillər */}
          {extractedImages.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <Image className="w-6 h-6 mr-3" />
                Çıxarılan Şəkillər ({extractedImages.length})
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {extractedImages.map((image) => (
                  <div
                    key={image.id}
                    className="bg-gray-50 rounded-xl p-6 border"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-800">
                        {image.name}
                      </h3>
                      <span className="text-sm text-gray-500">
                        Səhifə {image.page}
                      </span>
                    </div>

                    <div className="mb-4 p-4 bg-white rounded-lg border">
                      <img
                        src={image.base64}
                        alt={image.name}
                        className="w-full h-32 object-cover rounded"
                        style={{ backgroundColor: "#f0f0f0" }}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>Format: {image.format}</span>
                        <span>
                          {image.width}×{image.height}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {image.source === "embedded"
                          ? "📷 PDF-dən embedded şəkil"
                          : image.source === "page-render"
                          ? "📄 Səhifə render"
                          : "Çıxarılan şəkil"}
                      </div>

                      <div className="bg-gray-100 p-3 rounded-lg">
                        <p className="text-xs text-gray-600 mb-2">
                          Base64 Kodu:
                        </p>
                        <div className="bg-white p-2 rounded text-xs font-mono break-all max-h-20 overflow-y-auto">
                          {image.base64.substring(0, 100)}...
                        </div>
                      </div>

                      <div className="flex space-x-3">
                        <button
                          onClick={() => downloadImage(image)}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Yüklə
                        </button>
                        <button
                          onClick={() => copyBase64(image.base64)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          Base64 Kopyala
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFImageExtractor;
