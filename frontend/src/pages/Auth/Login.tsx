import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import './Auth.css';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getReasonToastMessage, getUiErrorMessage } from '../../utils/errorMessage';

const handledReasonKeys = new Set<string>();

const Login = () => {
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const redirectTo = useMemo(() => {
    const query = new URLSearchParams(location.search);
    const redirectFromQuery = query.get('redirect');
    const redirectFromState = (location.state as { from?: string } | null)?.from;
    return redirectFromQuery || redirectFromState || '/';
  }, [location.search, location.state]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reason = params.get('reason');
    if (!reason) {
      return;
    }

    const reasonKey = `${reason}|${params.get('redirect') || ''}`;
    if (handledReasonKeys.has(reasonKey)) {
      return;
    }
    handledReasonKeys.add(reasonKey);

    const reasonMessage = getReasonToastMessage(reason);
    if (reasonMessage) {
      addToast(reasonMessage, 'error');
    }

    params.delete('reason');
    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    );
  }, [location.pathname, location.search, addToast, navigate]);

  const validate = () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Vui lòng nhập email';
    if (!password.trim()) next.password = 'Vui lòng nhập mật khẩu';
    return next;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      setLoading(true);
      await login(email.trim(), password.trim());
      addToast('Đăng nhập thành công', 'success');
      navigate(redirectTo, { replace: true });
    } catch (error: unknown) {
      addToast(getUiErrorMessage(error, 'Đăng nhập thất bại'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Đăng nhập</h1>
        <p className="auth-subtitle">Đăng nhập để tích lũy quyền lợi và xem đơn hàng của bạn.</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label>Email</label>
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              name="email"
              autoComplete="email"
              spellCheck={false}
            />
            {errors.email && <div className="auth-error">{errors.email}</div>}
          </div>

          <div className="auth-field">
            <label>Mật khẩu</label>
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              name="password"
              autoComplete="current-password"
            />
            {errors.password && <div className="auth-error">{errors.password}</div>}
          </div>

          <div className="auth-link-row">
            <span />
            <Link to="/forgot">Quên mật khẩu?</Link>
          </div>

          <div className="auth-actions">
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? <><Loader2 size={18} className="auth-spinner" /> Đang đăng nhập...</> : 'Đăng nhập'}
            </button>
            <div className="auth-secondary">
              Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
            </div>
            <div className="auth-secondary" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={16} /> Bảo mật thanh toán và thông tin khách hàng
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
