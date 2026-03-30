import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Package, ArrowRight, Home, Truck, Gift } from 'lucide-react';
import ProductSection from '../../components/ProductSection/ProductSection';
import { mensFashion } from '../../mocks/products';
import './OrderSuccess.css';

const OrderSuccess = () => {
  const [searchParams] = useSearchParams();
  const [fallbackOrderId] = useState(() => Math.floor(Math.random() * 1000000).toString());
  const orderId = searchParams.get('id') || fallbackOrderId;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Confetti animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ['#1e3a8a', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
    const pieces: {
      x: number; y: number; r: number; d: number;
      color: string; tilt: number; tiltAngle: number; tiltAngleInc: number;
    }[] = [];

    for (let i = 0; i < 120; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        r: Math.random() * 6 + 4,
        d: Math.random() * 80 + 10,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        tilt: Math.floor(Math.random() * 10) - 10,
        tiltAngle: 0,
        tiltAngleInc: (Math.random() * 0.07) + 0.05,
      });
    }

    let angle = 0;
    let rafId: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      angle += 0.01;

      pieces.forEach(p => {
        p.tiltAngle += p.tiltAngleInc;
        p.y += (Math.cos(angle + p.d) + 1.5) * 1.2;
        p.x += Math.sin(angle) * 1.5;
        p.tilt = Math.sin(p.tiltAngle) * 12;

        ctx.beginPath();
        ctx.lineWidth = p.r / 2;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 4, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4);
        ctx.stroke();
      });

      // Reset pieces that fall off screen
      pieces.forEach(p => {
        if (p.y > canvas.height) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
      });

      rafId = requestAnimationFrame(draw);
    };

    draw();

    // Stop after 4s to save resources
    const stopTimer = setTimeout(() => {
      cancelAnimationFrame(rafId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 4000);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(stopTimer);
    };
  }, []);

  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + 3);
  const formattedDate = estimatedDate.toLocaleDateString('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric'
  });

  return (
    <div className="order-success-page">
      {/* Confetti Canvas */}
      <canvas ref={canvasRef} className="confetti-canvas" />

      <div className="os-wrapper">
        <div className="order-success-card">
          <div className="success-check-wrapper">
            <div className="success-check-circle">
              <CheckCircle size={48} />
            </div>
          </div>

          <h1 className="os-title">Đặt hàng thành công! 🎉</h1>
          <p className="os-subtitle">Cảm ơn bạn đã tin tưởng mua sắm tại Coolmate</p>

          <div className="os-order-info">
            <div className="os-info-row">
              <span className="os-label">Mã đơn hàng</span>
              <span className="os-value os-order-id">#{orderId}</span>
            </div>
            <div className="os-info-row">
              <span className="os-label">Trạng thái</span>
              <span className="os-value os-status">
                <Package size={14} /> Đang xử lý
              </span>
            </div>
            <div className="os-info-row">
              <span className="os-label">Phương thức thanh toán</span>
              <span className="os-value">Thanh toán khi nhận hàng</span>
            </div>
          </div>

          {/* Estimated Delivery */}
          <div className="os-delivery-estimate">
            <Truck size={18} className="os-delivery-icon" />
            <div>
              <p className="os-delivery-label">Dự kiến giao hàng</p>
              <p className="os-delivery-date">{formattedDate}</p>
            </div>
          </div>

          <p className="os-note">
            Bạn sẽ nhận được email xác nhận trong vài phút tới.
            Theo dõi đơn hàng trong phần <strong>Lịch sử đơn hàng</strong>.
          </p>

          <div className="os-actions">
            <Link to={`/profile/orders/${encodeURIComponent(orderId)}`} className="os-btn os-btn-outline">
              <Package size={16} />
              Xem đơn hàng
            </Link>
            <Link to={`/payment-result?status=success&orderCode=${orderId}`} className="os-btn os-btn-outline">
              <Home size={16} />
              Xem thanh toán
            </Link>
            <Link to="/" className="os-btn os-btn-primary">
              <Home size={16} />
              Tiếp tục mua sắm
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* Loyalty hint */}
          <div className="os-loyalty-hint">
            <Gift size={16} />
            <span>Bạn đã tích lũy thêm <strong>điểm CoolClub</strong> từ đơn hàng này!</span>
          </div>
        </div>

        {/* Cross-sell */}
        <div className="os-cross-sell">
          <ProductSection title="CÓ THỂ BẠN CŨNG THÍCH" products={mensFashion.slice(0, 4)} />
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
