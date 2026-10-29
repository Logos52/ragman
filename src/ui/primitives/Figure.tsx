import { useEffect, useState } from 'react';
import './Figure.css';

export interface FigureProps {
  /** images/avatar/base.png URL, or null to draw the line placeholder. */
  baseUrl: string | null;
  /** Worn-garment layer URLs, already in slot order (bottom first). */
  layers: string[];
  className?: string;
}

/**
 * The paper doll's figure in a 3:6 portrait frame. With no base image (or a base that fails to load)
 * it draws a clean line silhouette in --grid-line over a faint white radial glow. Never a photo.
 */
export function Figure({ baseUrl, layers, className }: FigureProps) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [baseUrl]);
  const useBase = !!baseUrl && !broken;
  return (
    <div className={className ? `rg-figure ${className}` : 'rg-figure'}>
      {useBase ? (
        <>
          <img className="rg-figure__layer" src={baseUrl!} alt="" draggable={false} onError={() => setBroken(true)} />
          {layers.map((src, i) => (
            <LayerImg key={`${src}-${i}`} src={src} />
          ))}
        </>
      ) : (
        <FigureSilhouette />
      )}
    </div>
  );
}

function LayerImg({ src }: { src: string }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return <img className="rg-figure__layer" src={src} alt="" draggable={false} onError={() => setGone(true)} />;
}

/** Standing figure, feet apart, arms slightly away from the body. 150 x 300 frame. */
export function FigureSilhouette() {
  return (
    <svg className="rg-figure__svg" viewBox="0 0 150 300" fill="none" aria-hidden>
      <ellipse cx="75" cy="30" rx="15.5" ry="18.5" />
      <path
        d={[
          'M68 48.5 L67.5 57',
          'C60 59.5 52 60.5 46 63.5',
          'C40.5 66.5 38.5 72 37.5 79',
          'L32.5 118',
          'L26 160',
          'C25 166 25.5 172 28.5 175',
          'C31.5 177 34.5 175 35 170',
          'L39.5 160',
          'L45 122',
          'L49 96',
          'L51.5 122',
          'C52.5 133 51 142 49.5 152',
          'L46 210',
          'L41 276',
          'C36 279 32 282 31 286.5',
          'C33 289 42 289 50.5 287',
          'L52.5 278',
          'L59 214',
          'L72 164',
          'Q75 160 78 164',
          'L91 214',
          'L97.5 278',
          'L99.5 287',
          'C108 289 117 289 119 286.5',
          'C118 282 114 279 109 276',
          'L104 210',
          'L100.5 152',
          'C99 142 97.5 133 98.5 122',
          'L101 96',
          'L105 122',
          'L110.5 160',
          'L115 170',
          'C115.5 175 118.5 177 121.5 175',
          'C124.5 172 125 166 124 160',
          'L117.5 118',
          'L112.5 79',
          'C111.5 72 109.5 66.5 104 63.5',
          'C98 60.5 90 59.5 82.5 57',
          'L82 48.5',
        ].join(' ')}
      />
    </svg>
  );
}
