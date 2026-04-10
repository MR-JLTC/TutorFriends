import React, { useEffect, useRef, useState } from 'react';
import AvatarEditor from 'react-avatar-editor';
import apiClient, { getFileUrl } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';

const AdminProfile: React.FC = () => {
  const { user } = useAuth();
  const [details, setDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedQr, setSelectedQr] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);

  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);

  // Crop modal state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropScale, setCropScale] = useState(1);
  const editorRef = useRef<AvatarEditor>(null);
  // file input ref to allow resetting
  const qrInputRef = useRef<HTMLInputElement>(null);

  const [qrFullscreen, setQrFullscreen] = useState(false);
  const [qrCacheBust, setQrCacheBust] = useState<number>(Date.now());
  const [gcashNumber, setGcashNumber] = useState('');
  const [gcashError, setGcashError] = useState<string | null>(null);
  const [savingGcash, setSavingGcash] = useState(false);
  const [gcashSaved, setGcashSaved] = useState(false);

  const load = async () => {
    if (!user?.user_id) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/users/${user.user_id}/admin-profile`);
      setDetails(res.data);
      if (res.data?.gcash_number) setGcashNumber(res.data.gcash_number);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Open crop modal instead of setting qrPreview directly
  const onChooseQr = (file?: File) => {
    if (!file) return;
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(file));
    setCropScale(1);
  };

  // Called when user confirms crop
  const onCropConfirm = () => {
    if (!editorRef.current) return;
    editorRef.current.getImageScaledToCanvas().toBlob((blob) => {
      if (!blob) return;
      const croppedFile = new File([blob], 'admin_qr_cropped.png', { type: 'image/png' });
      setSelectedQr(croppedFile);
      if (qrPreview) URL.revokeObjectURL(qrPreview);
      setQrPreview(URL.createObjectURL(croppedFile));
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
      if (qrInputRef.current) qrInputRef.current.value = '';
    }, 'image/png');
  };

  const onCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    if (qrInputRef.current) qrInputRef.current.value = '';
  };

  const onChooseProfileImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setProfileImage(file);
    if (profileImagePreview) URL.revokeObjectURL(profileImagePreview);
    setProfileImagePreview(URL.createObjectURL(file));
  };

  const onSaveProfileImage = async () => {
    if (!user?.user_id || !profileImage) return;
    try {
      setIsUploadingProfile(true);
      const fd = new FormData();
      fd.append('file', profileImage);
      const res = await apiClient.post(`/users/${user.user_id}/profile-image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const updatedUser = { ...user, profile_image_url: res.data.profile_image_url };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      await load();
      setProfileImage(null);
      if (profileImagePreview) {
        URL.revokeObjectURL(profileImagePreview);
        setProfileImagePreview(null);
      }
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Failed to upload profile image');
    } finally {
      setIsUploadingProfile(false);
    }
  };

  const onGcashChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    setGcashNumber(digits);
    setGcashSaved(false);
    if (digits.length === 0) {
      setGcashError(null);
    } else if (!digits.startsWith('09')) {
      setGcashError('GCash number must start with 09');
    } else if (digits.length !== 11) {
      setGcashError('GCash number must be exactly 11 digits');
    } else {
      setGcashError(null);
    }
  };

  const onSaveGcash = async () => {
    if (!user?.user_id) return;
    if (gcashNumber.length !== 11) {
      setGcashError('GCash number must be exactly 11 digits');
      return;
    }
    try {
      setSavingGcash(true);
      await apiClient.patch(`/users/${user.user_id}/admin-gcash-number`, { gcash_number: gcashNumber });
      setGcashSaved(true);
      setTimeout(() => setGcashSaved(false), 3000);
      setGcashError(null);
    } catch (err) {
      console.error(err);
      setGcashError('Failed to save GCash number');
    } finally {
      setSavingGcash(false);
    }
  };

  const onSave = async () => {
    if (!user?.user_id || !selectedQr) return;
    const form = new FormData();
    form.append('file', selectedQr);
    try {
      setSaving(true);
      await apiClient.post(`/users/${user.user_id}/admin-qr`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await load();
      setQrCacheBust(Date.now());
      setSelectedQr(null);
      if (qrPreview) {
        URL.revokeObjectURL(qrPreview);
        setQrPreview(null);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading profile…</div>;
  }

  if (!details) {
    return <div className="p-6">Profile not found.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Admin Profile</h1>

      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <img
                src={profileImagePreview || getFileUrl(details.profile_image_url || '')}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(details.name || 'Admin')}&background=random`;
                }}
                alt={details.name}
                className="h-24 w-24 rounded-full object-cover border"
                style={{ aspectRatio: '1 / 1' }}
              />
              <label
                className="absolute bottom-0 right-0 bg-white rounded-full p-1 border shadow cursor-pointer hover:bg-gray-100"
                title="Change profile photo"
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onChooseProfileImage}
                />
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              </label>
            </div>
            {profileImage && (
              <Button size="sm" onClick={onSaveProfileImage} disabled={isUploadingProfile}>
                {isUploadingProfile ? 'Uploading...' : 'Save Photo'}
              </Button>
            )}
          </div>
          <div>
            <div className="text-slate-800 font-semibold text-lg">{details.name}</div>
            <div className="text-slate-600 text-sm">{details.email}</div>
          </div>
        </div>
      </Card>

      {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4">
          <div className="text-slate-500 text-sm">University</div>
          <div className="text-slate-800">{details.university_name || 'N/A'}</div>
        </Card>
        <Card className="p-4">
          <div className="text-slate-500 text-sm">Joined</div>
          <div className="text-slate-800">
            {details.created_at ? new Date(details.created_at).toLocaleDateString() : 'N/A'}
          </div>
        </Card>
      </div> */}

      <Card className="p-5 sm:p-6 space-y-6">
        <h2 className="text-lg font-bold text-slate-800">GCash Payment Settings</h2>

        <div className="flex flex-col md:flex-row gap-5">
          {/* QR Code Section */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 space-y-4 flex-shrink-0">
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">QR Code</h3>
            <div className="flex flex-col items-center gap-3">
              <div
                className="relative w-40 h-40 sm:w-48 sm:h-48 bg-white border-2 border-slate-200 rounded-xl flex items-center justify-center overflow-hidden shadow-sm group/qr cursor-pointer"
                onClick={() => (qrPreview || details.qr_code_url) && setQrFullscreen(true)}
              >
                {qrPreview || details.qr_code_url ? (
                  <>
                    <img
                      src={qrPreview || (details.qr_code_url ? `${getFileUrl(details.qr_code_url)}?t=${qrCacheBust}` : '')}
                      alt="Admin QR"
                      className="w-full h-full object-contain p-1 transition-all duration-200 group-hover/qr:blur-[2px] group-hover/qr:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/qr:opacity-100 transition-opacity duration-200 bg-black/10 rounded-xl">
                      <svg className="h-8 w-8 text-slate-700 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                    </div>
                  </>
                ) : (
                  <div className="text-center px-2">
                    <svg className="h-8 w-8 text-slate-300 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-slate-400 text-xs">No QR uploaded</span>
                  </div>
                )}
              </div>
              <label className="block text-center">
                <span className="text-xs font-medium text-slate-500 mb-1.5 block">Upload QR Code Image</span>
                <input
                  ref={qrInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => onChooseQr(e.target.files?.[0] || undefined)}
                  disabled={saving}
                  className="block text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 file:cursor-pointer file:transition-colors"
                />
              </label>
              {selectedQr && (
                <Button onClick={onSave} disabled={saving} size="sm">
                  {saving ? 'Saving...' : 'Save QR'}
                </Button>
              )}
            </div>
          </div>

          {/* GCash Number Section */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 space-y-3 flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">GCash Number</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="09XXXXXXXXX"
                    value={gcashNumber}
                    onChange={(e) => onGcashChange(e.target.value)}
                    maxLength={11}
                    className={`w-full pl-10 pr-3 py-2.5 border-2 rounded-xl text-slate-800 font-medium tracking-wide focus:outline-none focus:ring-2 transition-colors ${
                      gcashError
                        ? 'border-red-300 focus:ring-red-200 bg-red-50/50'
                        : gcashNumber.length === 11
                          ? 'border-green-300 focus:ring-green-200 bg-green-50/50'
                          : 'border-slate-200 focus:ring-primary-200 bg-white'
                    }`}
                  />
                </div>
                <Button
                  onClick={onSaveGcash}
                  disabled={savingGcash || gcashNumber.length !== 11}
                  size="sm"
                >
                  {savingGcash ? 'Saving...' : 'Save'}
                </Button>
              </div>
              <div className="flex items-center justify-between px-1">
                {gcashError ? (
                  <p className="text-xs text-red-500 font-medium">{gcashError}</p>
                ) : (
                  <p className="text-xs text-slate-400">{gcashNumber.length}/11 digits</p>
                )}
                {gcashSaved && (
                  <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved!
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── QR Fullscreen Modal ── */}
      {qrFullscreen && (qrPreview || details.qr_code_url) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 cursor-pointer"
          onClick={() => setQrFullscreen(false)}
        >
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={qrPreview || (details.qr_code_url ? `${getFileUrl(details.qr_code_url)}?t=${qrCacheBust}` : '')}
              alt="Admin QR Full"
              className="w-full h-auto rounded-2xl shadow-2xl bg-white p-4"
            />
            <button
              onClick={() => setQrFullscreen(false)}
              className="absolute -top-3 -right-3 p-2 bg-white rounded-full shadow-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Crop Modal ── */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col gap-4 p-6">
            <h3 className="text-lg font-bold text-slate-800 text-center">Crop QR Code</h3>
            <p className="text-xs text-slate-500 text-center -mt-2">
              Drag to reposition · Use the slider to zoom
            </p>

            {/* Editor */}
            <div className="flex justify-center">
              <AvatarEditor
                ref={editorRef}
                image={cropSrc}
                width={256}
                height={256}
                border={16}
                borderRadius={0}
                scale={cropScale}
                rotate={0}
                style={{ borderRadius: '8px', border: '2px solid #e2e8f0' }}
              />
            </div>

            {/* Zoom slider */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                <span>Zoom</span>
                <span className="font-mono text-slate-400">{cropScale.toFixed(2)}×</span>
              </label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={cropScale}
                onChange={(e) => setCropScale(Number(e.target.value))}
                className="w-full accent-primary-600"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-1">
              <button
                onClick={onCropCancel}
                className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onCropConfirm}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold text-sm hover:from-sky-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
              >
                Crop &amp; Use
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProfile;
