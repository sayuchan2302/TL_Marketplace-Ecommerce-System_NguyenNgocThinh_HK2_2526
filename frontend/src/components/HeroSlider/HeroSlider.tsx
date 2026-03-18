import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './HeroSlider.css';

const slides = [
  {
    title: 'BỘ SƯU TẬP HÈ 2026',
    subtitle: 'Chất liệu mát, form fit tự tin ra phố',
    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=1920&auto=format&fit=crop',
    cta: 'Khám phá ngay',
  },
  {
    title: 'POLO COOLMAX SIÊU THOÁNG',
    subtitle: 'Khử mùi, thấm hút tốt, 10 phối màu mới',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=1920&auto=format&fit=crop',
    cta: 'Mua polo',
  },
  {
    title: 'QUẦN ACTIVE SERIES',
    subtitle: 'Co giãn 4 chiều, nhẹ và khô nhanh',
    image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?q=80&w=1920&auto=format&fit=crop',
    cta: 'Thử ngay',
  },
  {
    title: 'SUMMER ESSENTIALS',
    subtitle: 'Tối giản, nhẹ nhàng, phối nhanh mọi dịp',
    image: 'https://images.unsplash.com/photo-1500522144261-ea64433bbe27?q=80&w=1920&auto=format&fit=crop',
    cta: 'Xem lookbook',
  },
  {
    title: 'COLLECTION DENIM',
    subtitle: 'Form slim, wash đẹp, bền màu lâu dài',
    image: 'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?q=80&w=1920&auto=format&fit=crop',
    cta: 'Mua denim',
  },
];

const AUTO_DELAY = 5500;

const HeroSlider = () => {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const next = () => setIndex((prev) => (prev + 1) % slides.length);
  const prev = () => setIndex((prev) => (prev - 1 + slides.length) % slides.length);

  useEffect(() => {
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = setInterval(next, AUTO_DELAY);
    return () => { timerRef.current && clearInterval(timerRef.current); };
  }, [index]);

  return (
    <section className="hero-slider">
      {slides.map((slide, i) => (
        <div key={slide.title} className={`hero-slide ${i === index ? 'active' : ''}`}>
          <img src={slide.image} alt={slide.title} className="hero-image" loading={i === index ? 'eager' : 'lazy'} />
          <div className="hero-overlay" />
          <div className="hero-content">
            <h1 className="hero-title">{slide.title}</h1>
            <p className="hero-subtitle">{slide.subtitle}</p>
            <button className="hero-btn">{slide.cta}</button>
          </div>
        </div>
      ))}

      <button className="hero-nav prev" onClick={prev} aria-label="Slide trước">
        <ChevronLeft size={22} />
      </button>
      <button className="hero-nav next" onClick={next} aria-label="Slide tiếp">
        <ChevronRight size={22} />
      </button>

      <div className="hero-dots">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`dot ${i === index ? 'active' : ''}`}
            onClick={() => setIndex(i)}
            aria-label={`Chuyển tới banner ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
};

export default HeroSlider;
