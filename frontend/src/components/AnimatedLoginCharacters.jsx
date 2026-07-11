import { useEffect, useRef, useState } from 'react';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function useBlink(minMs = 3000, maxMs = 7000) {
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    let blinkTimer;
    let openTimer;

    const schedule = () => {
      const wait = minMs + Math.random() * (maxMs - minMs);
      blinkTimer = window.setTimeout(() => {
        setBlinking(true);
        openTimer = window.setTimeout(() => {
          setBlinking(false);
          schedule();
        }, 150);
      }, wait);
    };

    schedule();
    return () => {
      window.clearTimeout(blinkTimer);
      window.clearTimeout(openTimer);
    };
  }, [minMs, maxMs]);

  return blinking;
}

/**
 * Eyes track the pointer; optional forceLook overrides (password peek / look-at-each-other).
 * Feet stay planted — only pupils move.
 */
function EyeBall({
  size = 18,
  pupilSize = 7,
  maxDistance = 5,
  eyeColor = 'white',
  pupilColor = '#2D2D2D',
  isBlinking = false,
  forceLookX,
  forceLookY,
  pupilOnly = false,
}) {
  const eyeRef = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const frameRef = useRef(0);

  useEffect(() => {
    if (forceLookX !== undefined && forceLookY !== undefined) {
      setOffset({ x: forceLookX, y: forceLookY });
      return undefined;
    }

    const onMove = (event) => {
      if (frameRef.current) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = 0;
        const el = eyeRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = event.clientX - cx;
        const dy = event.clientY - cy;
        const dist = Math.min(Math.hypot(dx, dy), maxDistance);
        const angle = Math.atan2(dy, dx);
        setOffset({
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
        });
      });
    };

    const reset = () => setOffset({ x: 0, y: 0 });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('blur', reset);
    document.documentElement.addEventListener('mouseleave', reset);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('blur', reset);
      document.documentElement.removeEventListener('mouseleave', reset);
      window.cancelAnimationFrame(frameRef.current);
    };
  }, [forceLookX, forceLookY, maxDistance]);

  if (pupilOnly) {
    return (
      <div
        ref={eyeRef}
        className={`login-eyeball pupil-only${isBlinking ? ' is-blinking' : ''}`}
        style={{ width: size, height: isBlinking ? 2 : size }}
      >
        {!isBlinking && (
          <span
            className="login-pupil"
            style={{
              width: pupilSize,
              height: pupilSize,
              backgroundColor: pupilColor,
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      ref={eyeRef}
      className={`login-eyeball${isBlinking ? ' is-blinking' : ''}`}
      style={{
        width: size,
        height: isBlinking ? 2 : size,
        backgroundColor: eyeColor,
      }}
    >
      {!isBlinking && (
        <span
          className="login-pupil"
          style={{
            width: pupilSize,
            height: pupilSize,
            backgroundColor: pupilColor,
            transform: `translate(${offset.x}px, ${offset.y}px)`,
          }}
        />
      )}
    </div>
  );
}

function EyePair({
  gap = 28,
  size,
  pupilSize,
  maxDistance,
  light = true,
  blinking = false,
  forceLookX,
  forceLookY,
  pupilOnly = false,
  style,
}) {
  const shared = {
    size,
    pupilSize,
    maxDistance,
    eyeColor: light ? 'white' : 'transparent',
    pupilColor: '#2D2D2D',
    isBlinking: blinking,
    forceLookX,
    forceLookY,
    pupilOnly,
  };

  return (
    <div className="login-eye-pair" style={{ gap, ...style }}>
      <EyeBall {...shared} />
      <EyeBall {...shared} />
    </div>
  );
}

/**
 * Planted character: outer shell never translates/margins off the floor.
 * Lean + breathe apply only to .character-body with transform-origin: bottom center.
 * A static .character-sole under the body keeps the visual base fixed.
 */
function Character({
  tone,
  className = '',
  lean = 0,
  rise = false,
  children,
}) {
  return (
    <div className={`character character-${tone} ${className}`.trim()}>
      {/* Fixed sole — never skewed / lifted */}
      <span className="character-sole" aria-hidden="true" />
      {/* Outer: lean only. Inner: scaleY breathe. Origin is floor for both. */}
      <div
        className={`character-body${rise ? ' is-tall' : ''}`}
        style={{ transform: `skewX(${lean}deg)` }}
      >
        <div className="character-body-fill">{children}</div>
      </div>
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
  const [pointerLean, setPointerLean] = useState(0);
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false);
  const [isPurplePeeking, setIsPurplePeeking] = useState(false);
  const purpleBlinking = useBlink();
  const blackBlinking = useBlink(3200, 6800);

  const isTyping = accountFocused || passwordFocused;
  const hidingPassword = passwordFocused && !passwordVisible;
  const passwordExposed = passwordFocused && passwordVisible;
  const idle = !accountFocused && !passwordFocused;

  // Very soft ambient lean when idle — eyes do most tracking so soles stay visually planted
  useEffect(() => {
    const onMove = (event) => {
      if (frameRef.current) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = 0;
        const rect = sceneRef.current?.getBoundingClientRect();
        if (!rect) return;
        const nx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        // Keep lean tiny (±2°) so the silhouette base barely shifts
        setPointerLean(clamp(-nx * 1.6, -2, 2));
      });
    };

    const reset = () => setPointerLean(0);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('blur', reset);
    document.documentElement.addEventListener('mouseleave', reset);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('blur', reset);
      document.documentElement.removeEventListener('mouseleave', reset);
      window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // When user starts typing, characters glance at each other briefly
  useEffect(() => {
    if (!isTyping) {
      setIsLookingAtEachOther(false);
      return undefined;
    }
    setIsLookingAtEachOther(true);
    const timer = window.setTimeout(() => setIsLookingAtEachOther(false), 800);
    return () => window.clearTimeout(timer);
  }, [isTyping]);

  // Purple sneaky peek when password is visible
  useEffect(() => {
    if (!passwordExposed) {
      setIsPurplePeeking(false);
      return undefined;
    }

    let peekTimer;
    let holdTimer;

    const schedule = () => {
      peekTimer = window.setTimeout(() => {
        setIsPurplePeeking(true);
        holdTimer = window.setTimeout(() => {
          setIsPurplePeeking(false);
          schedule();
        }, 800);
      }, 2000 + Math.random() * 3000);
    };

    schedule();
    return () => {
      window.clearTimeout(peekTimer);
      window.clearTimeout(holdTimer);
    };
  }, [passwordExposed]);

  // Body leans: intentional poses when focused; gentle ambient when idle
  const purpleLean = passwordExposed
    ? 0
    : hidingPassword
      ? -10
      : accountFocused
        ? -7
        : isLookingAtEachOther
          ? -5
          : idle
            ? pointerLean * 0.85
            : pointerLean * 0.5;

  const blackLean = passwordExposed
    ? 0
    : hidingPassword
      ? -8
      : accountFocused
        ? 7
        : isLookingAtEachOther
          ? 8
          : idle
            ? pointerLean * 0.7
            : pointerLean * 0.45;

  const orangeLean = passwordExposed
    ? 0
    : hidingPassword
      ? -5
      : idle
        ? pointerLean * 0.55
        : pointerLean * 0.35;

  const yellowLean = passwordExposed
    ? 0
    : hidingPassword
      ? -6
      : idle
        ? pointerLean * 0.6
        : pointerLean * 0.4;

  // Force look directions for story beats
  const purpleForce =
    passwordExposed
      ? isPurplePeeking
        ? { x: 4, y: 5 }
        : { x: -4, y: -4 }
      : isLookingAtEachOther
        ? { x: 3, y: 4 }
        : { x: undefined, y: undefined };

  const blackForce =
    passwordExposed
      ? { x: -4, y: -3 }
      : isLookingAtEachOther
        ? { x: -3, y: 3 }
        : { x: undefined, y: undefined };

  const frontForce = passwordExposed
    ? { x: -4, y: -3 }
    : hidingPassword
      ? { x: 5, y: -2 }
      : { x: undefined, y: undefined };

  return (
    <div
      ref={sceneRef}
      className={[
        'login-characters',
        idle ? 'is-idle' : '',
        isTyping ? 'is-engaged' : '',
        accountFocused ? 'account-active' : '',
        hidingPassword ? 'password-hidden' : '',
        passwordExposed ? 'password-visible' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      {/* Ground shadow — fixed, never follows lean */}
      <span className="login-characters-ground" />

      <Character
        tone="purple"
        lean={purpleLean}
        rise={hidingPassword || accountFocused}
      >
        <EyePair
          gap={32}
          size={18}
          pupilSize={7}
          maxDistance={5}
          light
          blinking={purpleBlinking && !hidingPassword}
          forceLookX={purpleForce.x}
          forceLookY={purpleForce.y}
          style={{ top: passwordExposed ? 34 : isLookingAtEachOther ? 58 : 40 }}
        />
      </Character>

      <Character tone="black" lean={blackLean}>
        <EyePair
          gap={22}
          size={16}
          pupilSize={6}
          maxDistance={4}
          light
          blinking={blackBlinking && !hidingPassword}
          forceLookX={blackForce.x}
          forceLookY={blackForce.y}
          style={{ top: passwordExposed ? 26 : isLookingAtEachOther ? 14 : 32 }}
        />
      </Character>

      <Character
        tone="orange"
        className={hidingPassword ? 'is-whisper' : ''}
        lean={orangeLean}
      >
        <EyePair
          gap={36}
          size={14}
          pupilSize={9}
          maxDistance={4}
          pupilOnly
          forceLookX={frontForce.x}
          forceLookY={frontForce.y}
          style={{ top: '46%' }}
        />
      </Character>

      <Character
        tone="yellow"
        className={hidingPassword ? 'is-whisper' : ''}
        lean={yellowLean}
      >
        <EyePair
          gap={28}
          size={12}
          pupilSize={8}
          maxDistance={4}
          pupilOnly
          forceLookX={frontForce.x}
          forceLookY={frontForce.y}
          style={{ top: 44 }}
        />
        <span
          className="character-mouth"
          style={{
            transform: `translateX(calc(-50% + ${(frontForce.x ?? 0) * 0.4}px)) translateY(${(frontForce.y ?? 0) * 0.25}px)`,
          }}
        />
      </Character>
    </div>
  );
}
