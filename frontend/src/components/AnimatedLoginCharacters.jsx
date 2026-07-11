import { useEffect, useRef, useState } from 'react';

/**
 * Faithful port of the 21st.dev / animated-characters-login-page characters.
 * Integrated as a controlled showcase driven by login form focus/visibility.
 */

function Pupil({
  size = 12,
  maxDistance = 5,
  pupilColor = 'black',
  forceLookX,
  forceLookY,
}) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const pupilRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const calculatePupilPosition = () => {
    if (!pupilRef.current) return { x: 0, y: 0 };

    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }

    const pupil = pupilRef.current.getBoundingClientRect();
    const pupilCenterX = pupil.left + pupil.width / 2;
    const pupilCenterY = pupil.top + pupil.height / 2;

    const deltaX = mouseX - pupilCenterX;
    const deltaY = mouseY - pupilCenterY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);

    const angle = Math.atan2(deltaY, deltaX);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    return { x, y };
  };

  const pupilPosition = calculatePupilPosition();

  return (
    <div
      ref={pupilRef}
      className="rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: pupilColor,
        transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
        transition: 'transform 0.1s ease-out',
      }}
    />
  );
}

function EyeBall({
  size = 48,
  pupilSize = 16,
  maxDistance = 10,
  eyeColor = 'white',
  pupilColor = 'black',
  isBlinking = false,
  forceLookX,
  forceLookY,
}) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const eyeRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const calculatePupilPosition = () => {
    if (!eyeRef.current) return { x: 0, y: 0 };

    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }

    const eye = eyeRef.current.getBoundingClientRect();
    const eyeCenterX = eye.left + eye.width / 2;
    const eyeCenterY = eye.top + eye.height / 2;

    const deltaX = mouseX - eyeCenterX;
    const deltaY = mouseY - eyeCenterY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);

    const angle = Math.atan2(deltaY, deltaX);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    return { x, y };
  };

  const pupilPosition = calculatePupilPosition();

  return (
    <div
      ref={eyeRef}
      className="rounded-full flex items-center justify-center transition-all duration-150"
      style={{
        width: `${size}px`,
        height: isBlinking ? '2px' : `${size}px`,
        backgroundColor: eyeColor,
        overflow: 'hidden',
      }}
    >
      {!isBlinking && (
        <div
          className="rounded-full"
          style={{
            width: `${pupilSize}px`,
            height: `${pupilSize}px`,
            backgroundColor: pupilColor,
            transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
            transition: 'transform 0.1s ease-out',
          }}
        />
      )}
    </div>
  );
}

function calculatePosition(ref, mouseX, mouseY) {
  if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };

  const rect = ref.current.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 3;

  const deltaX = mouseX - centerX;
  const deltaY = mouseY - centerY;

  const faceX = Math.max(-15, Math.min(15, deltaX / 20));
  const faceY = Math.max(-10, Math.min(10, deltaY / 30));
  const bodySkew = Math.max(-6, Math.min(6, -deltaX / 120));

  return { faceX, faceY, bodySkew };
}

/**
 * @param {object} props
 * @param {boolean} props.accountFocused - email/account field focused (isTyping)
 * @param {boolean} props.passwordFocused - password field focused
 * @param {boolean} props.passwordVisible - show password toggle on
 * @param {string}  props.password - current password value (for hide/peek poses)
 */
export default function AnimatedLoginCharacters({
  accountFocused = false,
  passwordFocused = false,
  passwordVisible = false,
  password = '',
}) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false);
  const [isBlackBlinking, setIsBlackBlinking] = useState(false);
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false);
  const [isPurplePeeking, setIsPurplePeeking] = useState(false);
  const [, setTick] = useState(0);

  const purpleRef = useRef(null);
  const blackRef = useRef(null);
  const yellowRef = useRef(null);
  const orangeRef = useRef(null);

  const showPassword = passwordVisible;
  // Match reference: isTyping while focused on inputs
  const isTyping = accountFocused || passwordFocused;
  const hasPassword = password.length > 0;
  const passwordHiddenMode = hasPassword && !showPassword;
  const passwordVisibleMode = hasPassword && showPassword;

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
      // Force re-render so calculatePosition runs with latest mouse
      setTick((n) => n + 1);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Blinking — purple
  useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000;
    let cancelled = false;
    let timeoutId;

    const scheduleBlink = () => {
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        setIsPurpleBlinking(true);
        window.setTimeout(() => {
          if (cancelled) return;
          setIsPurpleBlinking(false);
          scheduleBlink();
        }, 150);
      }, getRandomBlinkInterval());
    };

    scheduleBlink();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  // Blinking — black
  useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000;
    let cancelled = false;
    let timeoutId;

    const scheduleBlink = () => {
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        setIsBlackBlinking(true);
        window.setTimeout(() => {
          if (cancelled) return;
          setIsBlackBlinking(false);
          scheduleBlink();
        }, 150);
      }, getRandomBlinkInterval());
    };

    scheduleBlink();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  // Looking at each other when typing starts
  useEffect(() => {
    if (isTyping) {
      setIsLookingAtEachOther(true);
      const timer = window.setTimeout(() => setIsLookingAtEachOther(false), 800);
      return () => window.clearTimeout(timer);
    }
    setIsLookingAtEachOther(false);
    return undefined;
  }, [isTyping]);

  // Purple sneaky peeking when password is visible
  useEffect(() => {
    if (hasPassword && showPassword) {
      let cancelled = false;
      let peekTimeout;

      const schedulePeek = () => {
        peekTimeout = window.setTimeout(() => {
          if (cancelled) return;
          setIsPurplePeeking(true);
          window.setTimeout(() => {
            if (cancelled) return;
            setIsPurplePeeking(false);
            schedulePeek();
          }, 800);
        }, Math.random() * 3000 + 2000);
      };

      schedulePeek();
      return () => {
        cancelled = true;
        window.clearTimeout(peekTimeout);
        setIsPurplePeeking(false);
      };
    }
    setIsPurplePeeking(false);
    return undefined;
  }, [hasPassword, showPassword]);

  const purplePos = calculatePosition(purpleRef, mouseX, mouseY);
  const blackPos = calculatePosition(blackRef, mouseX, mouseY);
  const yellowPos = calculatePosition(yellowRef, mouseX, mouseY);
  const orangePos = calculatePosition(orangeRef, mouseX, mouseY);

  return (
    <div className="login-characters-scene" aria-hidden="true">
      <div className="login-characters-stage" style={{ width: '550px', height: '400px', maxWidth: '100%' }}>
        {/* Purple tall rectangle — back */}
        <div
          ref={purpleRef}
          className="absolute bottom-0 transition-all duration-700 ease-in-out"
          style={{
            left: '70px',
            width: '180px',
            height: isTyping || passwordHiddenMode ? '440px' : '400px',
            backgroundColor: '#6C3FF5',
            borderRadius: '10px 10px 0 0',
            zIndex: 1,
            transform: passwordVisibleMode
              ? 'skewX(0deg)'
              : isTyping || passwordHiddenMode
                ? `skewX(${(purplePos.bodySkew || 0) - 12}deg) translateX(40px)`
                : `skewX(${purplePos.bodySkew || 0}deg)`,
            transformOrigin: 'bottom center',
          }}
        >
          <div
            className="absolute flex gap-8 transition-all duration-700 ease-in-out"
            style={{
              left: passwordVisibleMode
                ? '20px'
                : isLookingAtEachOther
                  ? '55px'
                  : `${45 + purplePos.faceX}px`,
              top: passwordVisibleMode
                ? '35px'
                : isLookingAtEachOther
                  ? '65px'
                  : `${40 + purplePos.faceY}px`,
            }}
          >
            <EyeBall
              size={18}
              pupilSize={7}
              maxDistance={5}
              eyeColor="white"
              pupilColor="#2D2D2D"
              isBlinking={isPurpleBlinking}
              forceLookX={
                passwordVisibleMode
                  ? isPurplePeeking
                    ? 4
                    : -4
                  : isLookingAtEachOther
                    ? 3
                    : undefined
              }
              forceLookY={
                passwordVisibleMode
                  ? isPurplePeeking
                    ? 5
                    : -4
                  : isLookingAtEachOther
                    ? 4
                    : undefined
              }
            />
            <EyeBall
              size={18}
              pupilSize={7}
              maxDistance={5}
              eyeColor="white"
              pupilColor="#2D2D2D"
              isBlinking={isPurpleBlinking}
              forceLookX={
                passwordVisibleMode
                  ? isPurplePeeking
                    ? 4
                    : -4
                  : isLookingAtEachOther
                    ? 3
                    : undefined
              }
              forceLookY={
                passwordVisibleMode
                  ? isPurplePeeking
                    ? 5
                    : -4
                  : isLookingAtEachOther
                    ? 4
                    : undefined
              }
            />
          </div>
        </div>

        {/* Black tall rectangle — middle */}
        <div
          ref={blackRef}
          className="absolute bottom-0 transition-all duration-700 ease-in-out"
          style={{
            left: '240px',
            width: '120px',
            height: '310px',
            backgroundColor: '#2D2D2D',
            borderRadius: '8px 8px 0 0',
            zIndex: 2,
            transform: passwordVisibleMode
              ? 'skewX(0deg)'
              : isLookingAtEachOther
                ? `skewX(${(blackPos.bodySkew || 0) * 1.5 + 10}deg) translateX(20px)`
                : isTyping || passwordHiddenMode
                  ? `skewX(${(blackPos.bodySkew || 0) * 1.5}deg)`
                  : `skewX(${blackPos.bodySkew || 0}deg)`,
            transformOrigin: 'bottom center',
          }}
        >
          <div
            className="absolute flex gap-6 transition-all duration-700 ease-in-out"
            style={{
              left: passwordVisibleMode
                ? '10px'
                : isLookingAtEachOther
                  ? '32px'
                  : `${26 + blackPos.faceX}px`,
              top: passwordVisibleMode
                ? '28px'
                : isLookingAtEachOther
                  ? '12px'
                  : `${32 + blackPos.faceY}px`,
            }}
          >
            <EyeBall
              size={16}
              pupilSize={6}
              maxDistance={4}
              eyeColor="white"
              pupilColor="#2D2D2D"
              isBlinking={isBlackBlinking}
              forceLookX={passwordVisibleMode ? -4 : isLookingAtEachOther ? 0 : undefined}
              forceLookY={passwordVisibleMode ? -4 : isLookingAtEachOther ? -4 : undefined}
            />
            <EyeBall
              size={16}
              pupilSize={6}
              maxDistance={4}
              eyeColor="white"
              pupilColor="#2D2D2D"
              isBlinking={isBlackBlinking}
              forceLookX={passwordVisibleMode ? -4 : isLookingAtEachOther ? 0 : undefined}
              forceLookY={passwordVisibleMode ? -4 : isLookingAtEachOther ? -4 : undefined}
            />
          </div>
        </div>

        {/* Orange semi-circle — front left */}
        <div
          ref={orangeRef}
          className="absolute bottom-0 transition-all duration-700 ease-in-out"
          style={{
            left: '0px',
            width: '240px',
            height: '200px',
            zIndex: 3,
            backgroundColor: '#FF9B6B',
            borderRadius: '120px 120px 0 0',
            transform: passwordVisibleMode
              ? 'skewX(0deg)'
              : `skewX(${orangePos.bodySkew || 0}deg)`,
            transformOrigin: 'bottom center',
          }}
        >
          <div
            className="absolute flex gap-8 transition-all duration-200 ease-out"
            style={{
              left: passwordVisibleMode ? '50px' : `${82 + (orangePos.faceX || 0)}px`,
              top: passwordVisibleMode ? '85px' : `${90 + (orangePos.faceY || 0)}px`,
            }}
          >
            <Pupil
              size={12}
              maxDistance={5}
              pupilColor="#2D2D2D"
              forceLookX={passwordVisibleMode ? -5 : undefined}
              forceLookY={passwordVisibleMode ? -4 : undefined}
            />
            <Pupil
              size={12}
              maxDistance={5}
              pupilColor="#2D2D2D"
              forceLookX={passwordVisibleMode ? -5 : undefined}
              forceLookY={passwordVisibleMode ? -4 : undefined}
            />
          </div>
        </div>

        {/* Yellow tall capsule — front right */}
        <div
          ref={yellowRef}
          className="absolute bottom-0 transition-all duration-700 ease-in-out"
          style={{
            left: '310px',
            width: '140px',
            height: '230px',
            backgroundColor: '#E8D754',
            borderRadius: '70px 70px 0 0',
            zIndex: 4,
            transform: passwordVisibleMode
              ? 'skewX(0deg)'
              : `skewX(${yellowPos.bodySkew || 0}deg)`,
            transformOrigin: 'bottom center',
          }}
        >
          <div
            className="absolute flex gap-6 transition-all duration-200 ease-out"
            style={{
              left: passwordVisibleMode ? '20px' : `${52 + (yellowPos.faceX || 0)}px`,
              top: passwordVisibleMode ? '35px' : `${40 + (yellowPos.faceY || 0)}px`,
            }}
          >
            <Pupil
              size={12}
              maxDistance={5}
              pupilColor="#2D2D2D"
              forceLookX={passwordVisibleMode ? -5 : undefined}
              forceLookY={passwordVisibleMode ? -4 : undefined}
            />
            <Pupil
              size={12}
              maxDistance={5}
              pupilColor="#2D2D2D"
              forceLookX={passwordVisibleMode ? -5 : undefined}
              forceLookY={passwordVisibleMode ? -4 : undefined}
            />
          </div>
          <div
            className="absolute w-20 h-[4px] bg-[#2D2D2D] rounded-full transition-all duration-200 ease-out"
            style={{
              left: passwordVisibleMode ? '10px' : `${40 + (yellowPos.faceX || 0)}px`,
              top: passwordVisibleMode ? '88px' : `${88 + (yellowPos.faceY || 0)}px`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
