import { useEffect, useRef, useState } from 'react';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function useBlink() {
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    let blinkTimer;
    let openTimer;

    const schedule = () => {
      blinkTimer = window.setTimeout(() => {
        setBlinking(true);
        openTimer = window.setTimeout(() => {
          setBlinking(false);
          schedule();
        }, 140);
      }, 2800 + Math.random() * 3600);
    };

    schedule();
    return () => {
      window.clearTimeout(blinkTimer);
      window.clearTimeout(openTimer);
    };
  }, []);

  return blinking;
}

function CharacterEyes({ look, light = false, blinking = false, className = '' }) {
  return (
    <div
      className={`login-character-eyes ${light ? 'light' : ''} ${blinking ? 'blinking' : ''} ${className}`}
      style={{ '--eye-x': `${look.x}px`, '--eye-y': `${look.y}px` }}
    >
      <span><i /></span>
      <span><i /></span>
    </div>
  );
}

export default function AnimatedLoginCharacters({
  accountFocused = false,
  passwordFocused = false,
  passwordVisible = false,
}) {
  const sceneRef = useRef(null);
  const frameRef = useRef(0);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const purpleBlinking = useBlink();
  const blackBlinking = useBlink();
  const hidingPassword = passwordFocused && !passwordVisible;
  const passwordExposed = passwordFocused && passwordVisible;
  const idle = !accountFocused && !passwordFocused;
  const idleLean = clamp(-pointer.x * 0.65, -4.5, 4.5);

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (frameRef.current) return;
      frameRef.current = window.requestAnimationFrame(() => {
        const rect = sceneRef.current?.getBoundingClientRect();
        if (rect) {
          setPointer({
            x: clamp((event.clientX - (rect.left + rect.width / 2)) / 32, -7, 7),
            y: clamp((event.clientY - (rect.top + rect.height * 0.45)) / 42, -5, 5),
          });
        }
        frameRef.current = 0;
      });
    };

    const resetPointer = () => setPointer({ x: 0, y: 0 });
    window.addEventListener('pointermove', handlePointerMove);
    document.documentElement.addEventListener('mouseleave', resetPointer);
    window.addEventListener('blur', resetPointer);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.documentElement.removeEventListener('mouseleave', resetPointer);
      window.removeEventListener('blur', resetPointer);
      window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const purpleLook = accountFocused
    ? { x: 4, y: 3 }
    : hidingPassword
      ? { x: 6, y: 5 }
      : passwordExposed
        ? { x: -5, y: -3 }
        : pointer;
  const blackLook = accountFocused
    ? { x: -2, y: -4 }
    : hidingPassword
      ? { x: 6, y: 1 }
      : passwordExposed
        ? { x: -5, y: -3 }
        : pointer;
  const frontLook = hidingPassword
    ? { x: 6, y: -4 }
    : passwordExposed
      ? { x: -5, y: -3 }
      : pointer;
  const mouthLook = {
    x: frontLook.x * 0.42,
    y: frontLook.y * 0.28,
    rotate: frontLook.x * 0.32,
  };

  return (
    <div
      ref={sceneRef}
      className={`login-characters ${idle ? 'idle' : ''} ${accountFocused ? 'account-active' : ''} ${hidingPassword ? 'password-hidden' : ''} ${passwordExposed ? 'password-visible' : ''}`}
      style={{ '--idle-lean': `${idleLean}deg` }}
      aria-hidden="true"
    >
      <div className="character character-purple">
        <CharacterEyes look={purpleLook} light blinking={purpleBlinking && !hidingPassword} />
      </div>

      <div className="character character-black">
        <CharacterEyes look={blackLook} light blinking={blackBlinking && !hidingPassword} />
      </div>

      <div className="character character-orange">
        <CharacterEyes look={frontLook} className="pupil-only" />
      </div>

      <div className="character character-yellow">
        <CharacterEyes look={frontLook} className="pupil-only" />
        <span
          className="character-mouth"
          style={{
            '--mouth-x': `${mouthLook.x}px`,
            '--mouth-y': `${mouthLook.y}px`,
            '--mouth-rotate': `${mouthLook.rotate}deg`,
          }}
        />
      </div>
    </div>
  );
}
