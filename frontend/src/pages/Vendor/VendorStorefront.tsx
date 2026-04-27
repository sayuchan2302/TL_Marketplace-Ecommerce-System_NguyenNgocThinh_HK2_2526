import './Vendor.css';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Camera, ImagePlus, ShieldCheck, Upload } from 'lucide-react';
import VendorLayout from './VendorLayout';
import { vendorPortalService, type VendorSettingsData } from '../../services/vendorPortalService';
import { storeService, type StoreProfile } from '../../services/storeService';
import { useToast } from '../../contexts/ToastContext';
import { getUiErrorMessage } from '../../utils/errorMessage';
import { AdminStateBlock } from '../Admin/AdminStateBlocks';
import { PLACEHOLDER_STORE_BANNER } from '../../constants/placeholders';

const STORE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const STOREFRONT_AUTOSAVE_DELAY_MS = 700;

type StorefrontAutoSaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const defaultSettings: VendorSettingsData = {
  storeInfo: { name: '', slug: '', description: '', logo: '', banner: '', contactEmail: '', phone: '', address: '' },
  bankInfo: { bankName: '', accountNumber: '', accountHolder: '', verified: false },
  notifications: { newOrder: true, orderStatusChange: true, lowStock: true, payoutComplete: true, promotions: false },
  shipping: { ghn: true, ghtk: true, express: false, warehouseAddress: '', warehouseContact: '', warehousePhone: '' },
};

const resolveStorefrontStatus = (store: StoreProfile | null) => {
  if (!store) {
    return { label: 'Không xác định', detail: 'Không lấy được trạng thái gian hàng công khai.' };
  }

  if (store.approvalStatus !== 'APPROVED') {
    return { label: 'Chờ duyệt', detail: 'Store sẽ hiển thị công khai sau khi được admin phê duyệt.' };
  }

  if (store.status === 'ACTIVE') {
    return { label: 'Đang hoạt động', detail: 'Gian hàng công khai đang hiển thị cho người mua.' };
  }

  if (store.status === 'SUSPENDED') {
    return { label: 'Tạm khóa', detail: 'Gian hàng công khai tạm ẩn do vi phạm hồi kiểm duyệt.' };
  }

  return { label: 'Tạm offline', detail: 'Gian hàng công khai đang ở trạng thái không hoạt động.' };
};

const VendorStorefront = () => {
  const { addToast } = useToast();
  const [settings, setSettings] = useState<VendorSettingsData>(defaultSettings);
  const [storeMeta, setStoreMeta] = useState<StoreProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [uploadingAsset, setUploadingAsset] = useState<'logo' | 'banner' | null>(null);
  const [assetPreviews, setAssetPreviews] = useState<{ logo: string; banner: string }>({ logo: '', banner: '' });
  const [autoSaveState, setAutoSaveState] = useState<StorefrontAutoSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlsRef = useRef<{ logo: string | null; banner: string | null }>({ logo: null, banner: null });
  const autosaveTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const latestSettingsRef = useRef(settings);
  const syncedSettingsSnapshotRef = useRef('');
  const hydratedRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const queuedSaveRef = useRef(false);

  const updateStoreInfoField = useCallback((field: keyof VendorSettingsData['storeInfo'], value: string) => {
    setSettings((current) => ({
      ...current,
      storeInfo: {
        ...current.storeInfo,
        [field]: value,
      },
    }));
  }, []);

  const serializeSettings = useCallback((payload: VendorSettingsData) => JSON.stringify(payload), []);

  useEffect(() => {
    latestSettingsRef.current = settings;
  }, [settings]);

  const setAssetPreview = useCallback((field: 'logo' | 'banner', nextUrl: string) => {
    const previousUrl = previewUrlsRef.current[field];
    if (previousUrl && previousUrl.startsWith('blob:') && previousUrl !== nextUrl) {
      URL.revokeObjectURL(previousUrl);
    }
    previewUrlsRef.current[field] = nextUrl || null;
    setAssetPreviews((current) => (
      current[field] === nextUrl
        ? current
        : {
            ...current,
            [field]: nextUrl,
          }
    ));
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        setLoadError('');
        const [nextSettings, nextStore] = await Promise.all([
          vendorPortalService.getSettings(),
          storeService.getMyStore(),
        ]);
        if (!active) return;
        hydratedRef.current = false;
        syncedSettingsSnapshotRef.current = serializeSettings(nextSettings);
        latestSettingsRef.current = nextSettings;
        setSettings(nextSettings);
        setStoreMeta(nextStore);
        setAutoSaveState('idle');
        setLastSavedAt(null);
        hydratedRef.current = true;
      } catch (err: unknown) {
        if (!active) return;
        const message = getUiErrorMessage(err, 'Không tải được gian hàng công khai');
        setLoadError(message);
        addToast(message, 'error');
        setAutoSaveState('error');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [addToast, reloadKey, serializeSettings]);

  useEffect(() => () => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    (['logo', 'banner'] as const).forEach((field) => {
      const previewUrl = previewUrlsRef.current[field];
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    });
  }, []);

  const completion = useMemo(() => {
    const fields = [
      settings.storeInfo.name,
      settings.storeInfo.description,
      settings.storeInfo.logo,
      settings.storeInfo.banner,
      settings.storeInfo.contactEmail,
      settings.storeInfo.phone,
      settings.storeInfo.address,
    ];
    const filled = fields.filter((field) => field.trim()).length;
    return Math.round((filled / fields.length) * 100);
  }, [settings]);

  const persistSettings = useCallback(async () => {
    if (!hydratedRef.current) {
      return;
    }

    const payload = latestSettingsRef.current;
    const payloadSnapshot = serializeSettings(payload);
    if (!payloadSnapshot || payloadSnapshot === syncedSettingsSnapshotRef.current) {
      return;
    }

    if (saveInFlightRef.current) {
      queuedSaveRef.current = true;
      return;
    }

    saveInFlightRef.current = true;
    setAutoSaveState('saving');

    try {
      const nextSettings = await vendorPortalService.updateSettings(payload);
      const nextStore = await storeService.getMyStore();
      const latestSnapshot = serializeSettings(latestSettingsRef.current);

      syncedSettingsSnapshotRef.current = payloadSnapshot;
      setStoreMeta(nextStore);
      setLastSavedAt(Date.now());
      setAutoSaveState('saved');

      if (latestSnapshot === payloadSnapshot) {
        const normalizedSnapshot = serializeSettings(nextSettings);
        latestSettingsRef.current = nextSettings;
        syncedSettingsSnapshotRef.current = normalizedSnapshot;
        setSettings(nextSettings);
      } else {
        queuedSaveRef.current = true;
      }
    } catch (err: unknown) {
      setAutoSaveState('error');
      addToast(getUiErrorMessage(err, 'Tự động lưu gian hàng thất bại'), 'error');
    } finally {
      saveInFlightRef.current = false;
      if (queuedSaveRef.current) {
        queuedSaveRef.current = false;
        void persistSettings();
      }
    }
  }, [addToast, serializeSettings]);

  const flushPendingAutosave = useCallback(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    void persistSettings();
  }, [persistSettings]);

  const openImagePicker = (field: 'logo' | 'banner') => {
    if (uploadingAsset) {
      return;
    }
    if (field === 'logo') {
      logoInputRef.current?.click();
      return;
    }
    bannerInputRef.current?.click();
  };

  const handleImageSelected = async (field: 'logo' | 'banner', event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (file.size > STORE_IMAGE_MAX_BYTES) {
      addToast('Ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.', 'error');
      return;
    }

    try {
      setAssetPreview(field, URL.createObjectURL(file));
      setUploadingAsset(field);
      const imageUrl = await storeService.uploadStoreImage(file);
      updateStoreInfoField(field, imageUrl);
      setAssetPreview(field, '');
      addToast(field === 'logo' ? 'Đã tải logo gian hàng.' : 'Đã tải banner gian hàng.', 'success');
    } catch (err: unknown) {
      setAssetPreview(field, '');
      addToast(getUiErrorMessage(err, 'Không thể tải ảnh gian hàng lên'), 'error');
    } finally {
      setUploadingAsset(null);
    }
  };

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    const currentSnapshot = serializeSettings(settings);
    if (currentSnapshot === syncedSettingsSnapshotRef.current) {
      return;
    }

    if (!saveInFlightRef.current) {
      setAutoSaveState('pending');
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      void persistSettings();
    }, STOREFRONT_AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [persistSettings, serializeSettings, settings]);

  const storefrontStatus = resolveStorefrontStatus(storeMeta);
  const storefrontPath = settings.storeInfo.slug ? `/store/${settings.storeInfo.slug}` : '/store/:slug';

  const storefrontChecklist = useMemo(() => {
    const hasValue = (value: string) => value.trim().length > 0;
    const hasBrandIdentity = hasValue(settings.storeInfo.name) && hasValue(settings.storeInfo.description);
    const hasVisualAssets = hasValue(settings.storeInfo.logo) && hasValue(settings.storeInfo.banner);
    const hasContactInfo =
      hasValue(settings.storeInfo.contactEmail) &&
      hasValue(settings.storeInfo.phone) &&
      hasValue(settings.storeInfo.address);
    const hasSlug = hasValue(settings.storeInfo.slug);
    const isApproved = storeMeta?.approvalStatus === 'APPROVED';
    const isActive = storeMeta?.status === 'ACTIVE';

    return [
      {
        key: 'identity',
        label: 'Tên và mô tả gian hàng',
        ok: hasBrandIdentity,
        hint: hasBrandIdentity
          ? 'Đã có thông tin nhận diện thương hiệu cơ bản.'
          : 'Thiếu tên hoặc mô tả, khách hàng sẽ khó nhận diện gian hàng.',
      },
      {
        key: 'assets',
        label: 'Logo và banner',
        ok: hasVisualAssets,
        hint: hasVisualAssets
          ? 'Đã có đủ hình ảnh để hiển thị trên gian hàng công khai.'
          : 'Cần bổ sung logo hoặc banner để gian hàng công khai hiển thị đầy đủ.',
      },
      {
        key: 'contact',
        label: 'Thông tin liên hệ công khai',
        ok: hasContactInfo,
        hint: hasContactInfo
          ? 'Email, số điện thoại và địa chỉ đã đầy đủ.'
          : 'Thiếu email, số điện thoại hoặc địa chỉ công khai.',
      },
      {
        key: 'slug',
        label: 'Đường dẫn gian hàng',
        ok: hasSlug,
        hint: hasSlug ? `Gian hàng đang dùng đường dẫn ${storefrontPath}.` : 'Chưa có slug để tạo đường dẫn gian hàng.',
      },
      {
        key: 'approval',
        label: 'Phê duyệt từ admin',
        ok: isApproved,
        hint: isApproved
          ? 'Store đã được admin phê duyệt.'
          : storeMeta?.approvalStatus === 'REJECTED'
            ? storeMeta.rejectionReason
              ? `Store bị từ chối: ${storeMeta.rejectionReason}`
              : 'Store bị từ chối và cần cập nhật hồ sơ.'
            : 'Store đang chờ admin phê duyệt.',
      },
      {
        key: 'active',
        label: 'Trạng thái vận hành',
        ok: isActive,
        hint: isActive
          ? 'Store đang hoạt động, khách mua có thể truy cập gian hàng.'
          : storeMeta?.status === 'SUSPENDED'
            ? 'Store đang tạm khóa và tạm thời không hiển thị.'
            : 'Store chưa ở trạng thái hoạt động nên chưa công khai trên marketplace.',
      },
    ];
  }, [settings, storeMeta, storefrontPath]);

  const passedChecks = storefrontChecklist.filter((item) => item.ok).length;
  const isStorefrontReady = passedChecks === storefrontChecklist.length;
  const bannerPreview = assetPreviews.banner || settings.storeInfo.banner;
  const logoPreview = assetPreviews.logo || settings.storeInfo.logo;
  const autoSaveIndicator = useMemo(() => {
    switch (autoSaveState) {
      case 'pending':
        return { className: 'storefront-sync-status pending', label: 'Sẽ tự động lưu...' };
      case 'saving':
        return { className: 'storefront-sync-status saving', label: 'Đang tự động lưu...' };
      case 'saved':
        return {
          className: 'storefront-sync-status saved',
          label: lastSavedAt ? `Đã tự động lưu ${new Date(lastSavedAt).toLocaleTimeString('vi-VN')}` : 'Đã tự động lưu',
        };
      case 'error':
        return { className: 'storefront-sync-status error', label: 'Tự động lưu thất bại' };
      default:
        return { className: 'storefront-sync-status idle', label: 'Tự động lưu đang bật' };
    }
  }, [autoSaveState, lastSavedAt]);

  return (
    <VendorLayout
      title="Gian hàng công khai và bộ mặt thương hiệu"
      breadcrumbs={['Kênh Người Bán', 'Gian hàng']}
      actions={!loading ? <span className={autoSaveIndicator.className}>{autoSaveIndicator.label}</span> : undefined}
    >
      {loading ? (
        <AdminStateBlock
          type="empty"
          title="Đang tải gian hàng công khai"
          description="Hồ sơ gian hàng của shop đang được đồng bộ."
        />
      ) : loadError ? (
        <AdminStateBlock
          type="error"
          title="Không tải được gian hàng công khai"
          description={loadError}
          actionLabel="Thử lại"
          onAction={() => setReloadKey((key) => key + 1)}
        />
      ) : (
        <>

          <div className="admin-stats grid-4">
            <div className="admin-stat-card">
              <div className="admin-stat-label">Mức hoàn thiện</div>
              <div className="admin-stat-value">{completion}%</div>
              <div className="admin-stat-sub">Tính theo dữ liệu đang chỉnh sửa trên gian hàng công khai</div>
            </div>
            <div className="admin-stat-card success">
              <div className="admin-stat-label">Huy hiệu</div>
              <div className="admin-stat-value">{storeMeta?.isOfficial ? 'Chính hãng' : 'Tiêu chuẩn'}</div>
              <div className="admin-stat-sub">Tín hiệu tin cậy hiển thị trên hồ sơ công khai</div>
            </div>
            <div className="admin-stat-card info">
              <div className="admin-stat-label">Đường dẫn gian hàng</div>
              <div className="admin-stat-value">{storefrontPath}</div>
              <div className="admin-stat-sub">Đường dẫn truy cập gian hàng công khai trên marketplace</div>
            </div>
            <div className={`admin-stat-card ${storefrontStatus.label === 'Đang hoạt động' ? 'success' : 'warning'}`}>
              <div className="admin-stat-label">Trạng thái hiển thị</div>
              <div className="admin-stat-value">{storefrontStatus.label}</div>
              <div className="admin-stat-sub">{storefrontStatus.detail}</div>
            </div>
          </div>

          <div className="admin-panels storefront-grid">
            <div className="admin-left">
              <section className="admin-panel storefront-section-panel">
                <div className="admin-panel-head">
                  <h2>Thông tin công khai</h2>
                </div>
                <div className="form-grid">
                  <label className="form-field">
                    <span>Tên gian hàng</span>
                    <input
                      value={settings.storeInfo.name}
                      onChange={(e) => updateStoreInfoField('name', e.target.value)}
                      onBlur={flushPendingAutosave}
                    />
                  </label>
                  <label className="form-field">
                    <span>Email liên hệ</span>
                    <input
                      value={settings.storeInfo.contactEmail}
                      onChange={(e) => updateStoreInfoField('contactEmail', e.target.value)}
                      onBlur={flushPendingAutosave}
                    />
                  </label>
                  <label className="form-field">
                    <span>Số điện thoại</span>
                    <input
                      value={settings.storeInfo.phone}
                      onChange={(e) => updateStoreInfoField('phone', e.target.value)}
                      onBlur={flushPendingAutosave}
                    />
                  </label>
                  <label className="form-field full">
                    <span>Địa chỉ hiển thị công khai</span>
                    <input
                      value={settings.storeInfo.address}
                      onChange={(e) => updateStoreInfoField('address', e.target.value)}
                      onBlur={flushPendingAutosave}
                    />
                  </label>
                  <label className="form-field full">
                    <span>Mô tả gian hàng</span>
                    <textarea
                      rows={5}
                      value={settings.storeInfo.description}
                      onChange={(e) => updateStoreInfoField('description', e.target.value)}
                      onBlur={flushPendingAutosave}
                    />
                  </label>
                </div>
              </section>

              <section className="admin-panel storefront-section-panel">
                <div className="admin-panel-head">
                  <h2>Luồng vận hành gian hàng</h2>
                </div>
                <div className="admin-card-list storefront-flow-list">
                  <div className="storefront-flow-step">
                    <span className="storefront-flow-index">1</span>
                    <div className="storefront-flow-content">
                      <p className="admin-bold">Hoàn thiện hồ sơ hiển thị</p>
                      <p className="admin-muted">Điền đủ tên, mô tả, logo, banner và thông tin liên hệ.</p>
                    </div>
                  </div>
                  <div className="storefront-flow-step">
                    <span className="storefront-flow-index">2</span>
                    <div className="storefront-flow-content">
                      <p className="admin-bold">Được admin phê duyệt</p>
                      <p className="admin-muted">Store cần được duyệt để đủ điều kiện lên công khai.</p>
                    </div>
                  </div>
                  <div className="storefront-flow-step">
                    <span className="storefront-flow-index">3</span>
                    <div className="storefront-flow-content">
                      <p className="admin-bold">Store đang hoạt động</p>
                      <p className="admin-muted">
                        Store ở trạng thái tạm offline hoặc tạm khóa sẽ không hiển thị cho người mua.
                      </p>
                    </div>
                  </div>
                </div>
                <p className="admin-note">
                  <ShieldCheck size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                  Huy hiệu <strong>Chính hãng</strong> chỉ là tín hiệu uy tín bổ sung, không phải điều kiện bắt buộc để mở
                  gian hàng.
                </p>
              </section>
            </div>

            <div className="admin-right">
              <section className="admin-panel storefront-section-panel">
                <div className="admin-panel-head">
                  <div>
                    <h2>Xem trước gian hàng</h2>
                    <p className="admin-muted small storefront-preview-subtitle">
                      Bấm vào banner hoặc avatar để thay ảnh và xem trước ngay như khi lên storefront thật.
                    </p>
                  </div>
                </div>
                <div className="vendor-store-preview">
                  <div className={`vendor-store-preview-banner ${uploadingAsset === 'banner' ? 'is-uploading' : ''}`}>
                    <button
                      type="button"
                      className="vendor-store-preview-banner-button"
                      onClick={() => openImagePicker('banner')}
                      disabled={uploadingAsset !== null}
                      aria-label={bannerPreview ? 'Thay banner gian hàng' : 'Tải banner gian hàng'}
                      style={{
                        backgroundImage: `linear-gradient(rgba(15,23,42,.22), rgba(15,23,42,.38)), url(${
                          bannerPreview || PLACEHOLDER_STORE_BANNER
                        })`,
                      }}
                    >
                      <span className="vendor-store-preview-banner-overlay">
                        {uploadingAsset === 'banner' ? (
                          <>
                            <Upload size={18} />
                            <span>Đang tải banner...</span>
                          </>
                        ) : (
                          <>
                            <Camera size={18} />
                            <span>{bannerPreview ? 'Đổi banner' : 'Tải banner'}</span>
                          </>
                        )}
                      </span>
                    </button>
                    <input
                      ref={bannerInputRef}
                      type="file"
                      hidden
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                      onChange={(event) => void handleImageSelected('banner', event)}
                    />
                  </div>
                  <div className="vendor-store-preview-body">
                    <div className="vendor-store-preview-head">
                      <div className={`vendor-store-preview-logo ${uploadingAsset === 'logo' ? 'is-uploading' : ''}`}>
                        <button
                          type="button"
                          className="vendor-store-preview-logo-button"
                          onClick={() => openImagePicker('logo')}
                          disabled={uploadingAsset !== null}
                          aria-label={logoPreview ? 'Thay logo gian hàng' : 'Tải logo gian hàng'}
                        >
                          {logoPreview ? (
                            <img src={logoPreview} alt={settings.storeInfo.name || 'Logo gian hàng'} />
                          ) : (
                            <div className="vendor-store-preview-logo-empty">
                              <ImagePlus size={26} />
                            </div>
                          )}
                          <span className="vendor-store-preview-logo-overlay">
                            {uploadingAsset === 'logo' ? (
                              <>
                                <Upload size={16} />
                                <span>Đang tải...</span>
                              </>
                            ) : (
                              <>
                                <Camera size={16} />
                                <span>{logoPreview ? 'Đổi logo' : 'Tải logo'}</span>
                              </>
                            )}
                          </span>
                        </button>
                      </div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        hidden
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                        onChange={(event) => void handleImageSelected('logo', event)}
                      />
                      <div className="vendor-store-preview-copy">
                        <div className="vendor-store-preview-title">
                          <h3>{settings.storeInfo.name || 'Chưa cập nhật tên gian hàng'}</h3>
                          {storeMeta?.isOfficial ? (
                            <span className="admin-pill teal">
                              <ShieldCheck size={13} /> Chính hãng
                            </span>
                          ) : null}
                        </div>
                        <p>{storefrontStatus.label}</p>
                      </div>
                    </div>
                    <p className="vendor-store-preview-description">
                      {settings.storeInfo.description || 'Chưa cập nhật mô tả gian hàng.'}
                    </p>
                    <div className="vendor-store-preview-meta">
                      <span>{settings.storeInfo.contactEmail || 'Chưa cập nhật email liên hệ'}</span>
                      <span>{settings.storeInfo.phone || 'Chưa cập nhật số điện thoại'}</span>
                      <span>{settings.storeInfo.address || 'Chưa cập nhật địa chỉ gian hàng'}</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="admin-panel storefront-section-panel">
                <div className="admin-panel-head">
                  <h2>Checklist vận hành</h2>
                </div>
                {storeMeta?.approvalStatus === 'REJECTED' ? (
                  <p className="storefront-business-alert">
                    Store đang ở trạng thái <strong>Từ chối</strong>.
                    {storeMeta.rejectionReason ? ` Lý do: ${storeMeta.rejectionReason}` : ' Vui lòng cập nhật hồ sơ để gửi duyệt lại.'}
                  </p>
                ) : null}
                <div className="admin-card-list">
                  {storefrontChecklist.map((item) => (
                    <div key={item.key} className="admin-card-row storefront-check-row">
                      <div className="storefront-check-content">
                        <span className="admin-bold">{item.label}</span>
                        <span className="admin-muted">{item.hint}</span>
                      </div>
                      <span className={`admin-pill ${item.ok ? 'success' : 'warning'} storefront-check-pill`}>
                        {item.ok ? 'Đạt' : 'Chưa đạt'}
                      </span>
                    </div>
                  ))}
                </div>
                <p className={`storefront-readiness ${isStorefrontReady ? 'success' : 'warning'}`}>
                  {isStorefrontReady
                    ? 'Gian hàng đã đủ điều kiện công khai theo logic vận hành hiện tại.'
                    : `Gian hàng mới đạt ${passedChecks}/${storefrontChecklist.length} điều kiện. Hoàn tất các mục còn thiếu trước khi đưa lên công khai.`}
                </p>
              </section>
            </div>
          </div>
        </>
      )}
    </VendorLayout>
  );
};

export default VendorStorefront;

