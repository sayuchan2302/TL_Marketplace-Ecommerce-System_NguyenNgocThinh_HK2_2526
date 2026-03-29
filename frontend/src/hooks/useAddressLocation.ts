import { useState, useEffect, useCallback } from 'react';

export interface Province {
  code: number;
  name: string;
}

export interface District {
  code: number;
  name: string;
}

export interface Ward {
  code: number;
  name: string;
}

const API_BASE = 'https://provinces.open-api.vn/api';

export interface UseAddressLocationOptions {
  loadOnMount?: boolean;
}

export interface UseAddressLocationReturn {
  provinces: Province[];
  districts: District[];
  wards: Ward[];
  loadingProvinces: boolean;
  loadingDistricts: boolean;
  loadingWards: boolean;
  selectedProvinceCode: string;
  selectedDistrictCode: string;
  selectedWardCode: string;
  selectedProvinceName: string;
  selectedDistrictName: string;
  selectedWardName: string;
  setSelectedProvinceCode: (code: string) => void;
  setSelectedDistrictCode: (code: string) => void;
  setSelectedWardCode: (code: string) => void;
  clearSelection: () => void;
  setLocationByNames: (provinceName: string, districtName: string, wardName: string) => Promise<void>;
  getProvinceName: (code: string) => string;
  getDistrictName: (code: string) => string;
  getWardName: (code: string) => string;
}

export function useAddressLocation(options: UseAddressLocationOptions = {}): UseAddressLocationReturn {
  const { loadOnMount = true } = options;

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  const [selectedProvinceCode, setSelectedProvinceCodeState] = useState('');
  const [selectedDistrictCode, setSelectedDistrictCodeState] = useState('');
  const [selectedWardCode, setSelectedWardCodeState] = useState('');

  const [selectedProvinceName, setSelectedProvinceName] = useState('');
  const [selectedDistrictName, setSelectedDistrictName] = useState('');
  const [selectedWardName, setSelectedWardName] = useState('');

  const getProvinceName = useCallback((code: string) => {
    const province = provinces.find(p => String(p.code) === code);
    return province?.name || '';
  }, [provinces]);

  const getDistrictName = useCallback((code: string) => {
    const district = districts.find(d => String(d.code) === code);
    return district?.name || '';
  }, [districts]);

  const getWardName = useCallback((code: string) => {
    const ward = wards.find(w => String(w.code) === code);
    return ward?.name || '';
  }, [wards]);

  const setSelectedProvinceCode = useCallback((code: string) => {
    setSelectedProvinceCodeState(code);
    setSelectedDistrictCodeState('');
    setSelectedWardCodeState('');
    setSelectedDistrictName('');
    setSelectedWardName('');
    if (code) {
      const province = provinces.find(p => String(p.code) === code);
      setSelectedProvinceName(province?.name || '');
    } else {
      setSelectedProvinceName('');
    }
  }, [provinces]);

  const setSelectedDistrictCode = useCallback((code: string) => {
    setSelectedDistrictCodeState(code);
    setSelectedWardCodeState('');
    setSelectedWardName('');
    if (code) {
      const district = districts.find(d => String(d.code) === code);
      setSelectedDistrictName(district?.name || '');
    } else {
      setSelectedDistrictName('');
    }
  }, [districts]);

  const setSelectedWardCode = useCallback((code: string) => {
    setSelectedWardCodeState(code);
    if (code) {
      const ward = wards.find(w => String(w.code) === code);
      setSelectedWardName(ward?.name || '');
    } else {
      setSelectedWardName('');
    }
  }, [wards]);

  const clearSelection = useCallback(() => {
    setSelectedProvinceCodeState('');
    setSelectedDistrictCodeState('');
    setSelectedWardCodeState('');
    setSelectedProvinceName('');
    setSelectedDistrictName('');
    setSelectedWardName('');
    // Keep this idempotent to avoid re-render loops when called repeatedly.
    setDistricts((prev) => (prev.length === 0 ? prev : []));
    setWards((prev) => (prev.length === 0 ? prev : []));
  }, []);

  const setLocationByNames = useCallback(async (provinceName: string, districtName: string, wardName: string) => {
    const province = provinces.find(p => p.name === provinceName);
    if (!province) return;
    
    setSelectedProvinceCodeState(String(province.code));
    setSelectedProvinceName(provinceName);
    setLoadingDistricts(true);
    
    try {
      const distRes = await fetch(`${API_BASE}/p/${province.code}?depth=2`);
      const distData: { districts: District[] } = await distRes.json();
      setDistricts(distData.districts || []);
      
      const district = distData.districts?.find(d => d.name === districtName);
      if (!district) {
        setLoadingDistricts(false);
        return;
      }
      
      setSelectedDistrictCodeState(String(district.code));
      setSelectedDistrictName(districtName);
      setLoadingWards(true);
      
      try {
        const wardRes = await fetch(`${API_BASE}/d/${district.code}?depth=2`);
        const wardData: { wards: Ward[] } = await wardRes.json();
        setWards(wardData.wards || []);
        
        const ward = wardData.wards?.find(w => w.name === wardName);
        if (ward) {
          setSelectedWardCodeState(String(ward.code));
          setSelectedWardName(wardName);
        }
      } finally {
        setLoadingWards(false);
      }
    } finally {
      setLoadingDistricts(false);
    }
  }, [provinces]);

  useEffect(() => {
    if (!loadOnMount) return;
    setLoadingProvinces(true);
    fetch(`${API_BASE}/?depth=1`)
      .then(res => res.json())
      .then((data: Province[]) => {
        setProvinces(data);
        setLoadingProvinces(false);
      })
      .catch(() => setLoadingProvinces(false));
  }, [loadOnMount]);

  useEffect(() => {
    if (!selectedProvinceCode) {
      setDistricts([]);
      return;
    }
    setLoadingDistricts(true);
    fetch(`${API_BASE}/p/${selectedProvinceCode}?depth=2`)
      .then(res => res.json())
      .then((data: { districts: District[] }) => {
        setDistricts(data.districts || []);
        setLoadingDistricts(false);
      })
      .catch(() => setLoadingDistricts(false));
  }, [selectedProvinceCode]);

  useEffect(() => {
    if (!selectedDistrictCode) {
      setWards([]);
      return;
    }
    setLoadingWards(true);
    fetch(`${API_BASE}/d/${selectedDistrictCode}?depth=2`)
      .then(res => res.json())
      .then((data: { wards: Ward[] }) => {
        setWards(data.wards || []);
        setLoadingWards(false);
      })
      .catch(() => setLoadingWards(false));
  }, [selectedDistrictCode]);

  return {
    provinces,
    districts,
    wards,
    loadingProvinces,
    loadingDistricts,
    loadingWards,
    selectedProvinceCode,
    selectedDistrictCode,
    selectedWardCode,
    selectedProvinceName,
    selectedDistrictName,
    selectedWardName,
    setSelectedProvinceCode,
    setSelectedDistrictCode,
    setSelectedWardCode,
    clearSelection,
    setLocationByNames,
    getProvinceName,
    getDistrictName,
    getWardName,
  };
}
