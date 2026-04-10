import React, { useRef, useState } from 'react';
import AvatarEditor from 'react-avatar-editor';

interface GCashQRCropModalProps {
  cropSrc: string | null;
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
}

const GCashQRCropModal: React.FC<GCashQRCropModalProps> = ({ cropSrc, onConfirm, onCancel }) => {
  const [scale, setScale] = useState(1);
  const editorRef = useRef<AvatarEditor>(null);

  if (!cropSrc) return null;

  const handleConfirm = () => {
    if (!editorRef.current) return;
    editorRef.current.getImageScaledToCanvas().toBlob((blob) => {
      if (!blob) return;
      const croppedFile = new File([blob], 'gcash_qr_cropped.png', { type: 'image/png' });
      onConfirm(croppedFile);
    }, 'image/png');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Crop GCash QR Code</h3>
        
        <div className="flex justify-center mb-4">
          <AvatarEditor
            ref={editorRef}
            image={cropSrc}
            width={300}
            height={300}
            border={20}
            borderRadius={0}
            color={[0, 0, 0, 0.6]}
            scale={scale}
            rotate={0}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Zoom: {scale.toFixed(1)}x
          </label>
          <input
            type="range"
            min="1"
            max="3"
            step="0.1"
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default GCashQRCropModal;
