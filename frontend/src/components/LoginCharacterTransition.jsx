import '../styles/auth-transition.css'
import CampusBrand from './CampusBrand.jsx'

const ORBS = [
  {
    name: 'orange',
    color: '#ff9c70',
    endX: '-43vw',
    endY: 'calc(50vh - 180px)',
    width: '158px',
    height: '180px',
    orbitX: '-92px',
    orbitY: '48px',
    orbitTwoX: '58px',
    orbitTwoY: '-88px',
    delay: '0ms',
    zIndex: 3,
  },
  {
    name: 'purple',
    color: '#6d48f5',
    endX: '-34vw',
    endY: 'calc(50vh - 382px)',
    width: '126px',
    height: '382px',
    orbitX: '76px',
    orbitY: '-76px',
    orbitTwoX: '-82px',
    orbitTwoY: '-34px',
    delay: '45ms',
    zIndex: 1,
  },
  {
    name: 'black',
    color: '#25252b',
    endX: '-20vw',
    endY: 'calc(50vh - 278px)',
    width: '88px',
    height: '278px',
    orbitX: '96px',
    orbitY: '34px',
    orbitTwoX: '-44px',
    orbitTwoY: '92px',
    delay: '85ms',
    zIndex: 2,
  },
  {
    name: 'yellow',
    color: '#ead958',
    endX: '-9vw',
    endY: 'calc(50vh - 210px)',
    width: '104px',
    height: '210px',
    orbitX: '-38px',
    orbitY: '-104px',
    orbitTwoX: '104px',
    orbitTwoY: '18px',
    delay: '125ms',
    zIndex: 4,
  },
]

export default function LoginCharacterTransition() {
  return (
    <div className="landing-login-transition" aria-hidden="true">
      <span className="landing-login-transition__ring is-outer" />
      <span className="landing-login-transition__ring is-inner" />
      <span className="landing-login-transition__brand"><CampusBrand compact inverted /></span>
      {ORBS.map((orb) => (
        <span
          className={`landing-login-transition__orb is-${orb.name}`}
          key={orb.name}
          style={{
            '--orb-color': orb.color,
            '--end-x': orb.endX,
            '--end-y': orb.endY,
            '--end-width': orb.width,
            '--end-height': orb.height,
            '--orbit-x': orb.orbitX,
            '--orbit-y': orb.orbitY,
            '--orbit-two-x': orb.orbitTwoX,
            '--orbit-two-y': orb.orbitTwoY,
            '--orb-delay': orb.delay,
            zIndex: orb.zIndex,
          }}
        />
      ))}
    </div>
  )
}
