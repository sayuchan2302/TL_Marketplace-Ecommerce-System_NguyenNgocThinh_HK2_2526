import { useEffect, useMemo, useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { addressService } from '../../services/addressService';
import { useAddressLocation } from '../../hooks/useAddressLocation';
import { useToast } from '../../contexts/ToastContext';
import type { Address } from '../../types';

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void | Promise<void>;
  editingAddress?: Address | null;
}

export interface AddressData {
  fullName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  detail: string;
  isDefault: boolean;
}

const buildInitialDraft = (editingAddress?: Address | null): AddressData => ({
  fullName: editingAddress?.fullName || '',
  phone: editingAddress?.phone || '',
  province: editingAddress?.province || '',
  district: editingAddress?.district || '',
  ward: editingAddress?.ward || '',
  detail: editingAddress?.detail || '',
  isDefault: editingAddress?.isDefault || false,
});

const AddressModalForm = ({ onClose, onSave, editingAddress }: Omit<AddressModalProps, 'isOpen'>) => {
  const initialDraft = useMemo(() => buildInitialDraft(editingAddress), [editingAddress]);
  const [draft, setDraft] = useState<AddressData>(initialDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();
  const addressLocation = useAddressLocation({ loadOnMount: true });
  const { clearSelection, setLocationByNames } = addressLocation;

  useEffect(() => {
    if (!editingAddress) {
      clearSelection();
      return;
    }

    setLocationByNames(
      editingAddress.province,
      editingAddress.district,
      editingAddress.ward,
    );
  }, [clearSelection, setLocationByNames, editingAddress]);

  const updateDraft = <K extends keyof AddressData>(key: K, value: AddressData[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const addressData = {
      fullName: draft.fullName,
      phone: draft.phone,
      province: addressLocation.selectedProvinceName,
      district: addressLocation.selectedDistrictName,
      ward: addressLocation.selectedWardName,
      detail: draft.detail,
      isDefault: draft.isDefault,
    };

    try {
      setIsSubmitting(true);
      if (editingAddress?.id) {
        await addressService.updateOnBackend(editingAddress.id, addressData);
      } else {
        await addressService.addOnBackend(addressData);
      }
      await onSave?.();
      clearSelection();
      onClose();
      addToast(editingAddress ? 'Đã cập nhật địa chỉ' : 'Đã thêm địa chỉ mới', 'success');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể lưu địa chỉ. Vui lòng thử lại.';
      addToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal address-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <div>
            <p className="profile-modal-eyebrow">Địa chỉ giao hàng</p>
            <h2>{editingAddress ? 'Chỉnh sửa địa chỉ' : 'Thêm địa chỉ mới'}</h2>
          </div>
          <button className="profile-modal-close" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="profile-modal-body">
          <form className="profile-modal-form" onSubmit={handleSubmit}>
            <div className="modal-input-group">
              <span className="modal-floating-label">Họ và tên người nhận</span>
              <input
                type="text"
                className="modal-input"
                style={{ paddingLeft: '16px' }}
                value={draft.fullName}
                onChange={(e) => updateDraft('fullName', e.target.value)}
                autoComplete="name"
                name="fullName"
                required
              />
            </div>

            <div className="modal-input-group">
              <span className="modal-floating-label">Số điện thoại</span>
              <input
                type="tel"
                className="modal-input"
                style={{ paddingLeft: '16px' }}
                value={draft.phone}
                onChange={(e) => updateDraft('phone', e.target.value)}
                autoComplete="tel"
                name="phone"
                required
              />
            </div>

            <div className="modal-input-group">
              <span className="modal-floating-label">Tỉnh / Thành phố</span>
              <select
                className="modal-input modal-select"
                value={addressLocation.selectedProvinceCode}
                onChange={(e) => addressLocation.setSelectedProvinceCode(e.target.value)}
                required
              >
                <option value="">
                  {addressLocation.loadingProvinces ? 'Đang tải...' : '-- Chọn Tỉnh / Thành phố --'}
                </option>
                {addressLocation.provinces.map((province) => (
                  <option key={province.code} value={province.code}>
                    {province.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="modal-select-arrow" size={16} aria-hidden="true" />
            </div>

            <div className="modal-input-group">
              <span className="modal-floating-label">Quận / Huyện</span>
              <select
                className="modal-input modal-select"
                value={addressLocation.selectedDistrictCode}
                onChange={(e) => addressLocation.setSelectedDistrictCode(e.target.value)}
                disabled={!addressLocation.selectedProvinceCode}
                required
              >
                <option value="">
                  {addressLocation.loadingDistricts ? 'Đang tải...' : '-- Chọn Quận / Huyện --'}
                </option>
                {addressLocation.districts.map((district) => (
                  <option key={district.code} value={district.code}>
                    {district.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="modal-select-arrow" size={16} aria-hidden="true" />
            </div>

            <div className="modal-input-group">
              <span className="modal-floating-label">Phường / Xã</span>
              <select
                className="modal-input modal-select"
                value={addressLocation.selectedWardCode}
                onChange={(e) => addressLocation.setSelectedWardCode(e.target.value)}
                disabled={!addressLocation.selectedDistrictCode}
                required
              >
                <option value="">
                  {addressLocation.loadingWards ? 'Đang tải...' : '-- Chọn Phường / Xã --'}
                </option>
                {addressLocation.wards.map((ward) => (
                  <option key={ward.code} value={ward.code}>
                    {ward.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="modal-select-arrow" size={16} aria-hidden="true" />
            </div>

            <div className="modal-input-group">
              <span className="modal-floating-label">Địa chỉ cụ thể</span>
              <input
                type="text"
                className="modal-input"
                style={{ paddingLeft: '16px' }}
                placeholder="Số nhà, tên đường..."
                value={draft.detail}
                onChange={(e) => updateDraft('detail', e.target.value)}
                required
              />
            </div>

            <label className="address-default-check">
              <input
                type="checkbox"
                checked={draft.isDefault}
                onChange={(e) => updateDraft('isDefault', e.target.checked)}
              />
              <span className="address-check-custom"></span>
              Đặt làm địa chỉ mặc định
            </label>

            <button type="submit" className="modal-submit-btn">
              {isSubmitting ? 'ĐANG LƯU...' : editingAddress ? 'CẬP NHẬT' : 'LƯU ĐỊA CHỈ'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const AddressModal = ({ isOpen, onClose, onSave, editingAddress }: AddressModalProps) => {
  if (!isOpen) return null;

  return (
    <AddressModalForm
      key={editingAddress?.id || 'new-address'}
      onClose={onClose}
      onSave={onSave}
      editingAddress={editingAddress}
    />
  );
};

export default AddressModal;
