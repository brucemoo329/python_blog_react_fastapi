import AnimatedLoginCharacters from './AnimatedLoginCharacters.jsx';
import CampusBrand from './CampusBrand.jsx';

export function CharacterAuthBrand({ mobile = false }) {
  return (
    <CampusBrand
      compact={mobile}
      inverted={!mobile}
      className={mobile ? 'character-login-mobile-brand' : 'character-login-brand'}
    />
  );
}

export default function AnimatedAuthShowcase({
  accountFocused = false,
  passwordFocused = false,
  passwordVisible = false,
  password = '',
}) {
  return (
    <section className="character-login-showcase">
      <CharacterAuthBrand />

      <div className="character-login-visual">
        <AnimatedLoginCharacters
          accountFocused={accountFocused}
          passwordFocused={passwordFocused}
          passwordVisible={passwordVisible}
          password={password}
        />
      </div>

      <footer className="character-login-footer">
        <span>隐私政策</span>
        <span>服务条款</span>
        <span>联系我们</span>
      </footer>
    </section>
  );
}
