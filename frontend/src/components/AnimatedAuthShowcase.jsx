import { Sparkles } from 'lucide-react';
import AnimatedLoginCharacters from './AnimatedLoginCharacters.jsx';

export function CharacterAuthBrand({ mobile = false }) {
  return (
    <div className={mobile ? 'character-login-mobile-brand' : 'character-login-brand'}>
      <span className="character-login-brand-icon"><Sparkles size={18} /></span>
      <span>校园集市</span>
    </div>
  );
}

export default function AnimatedAuthShowcase({
  accountFocused = false,
  passwordFocused = false,
  passwordVisible = false,
}) {
  return (
    <section className="character-login-showcase">
      <CharacterAuthBrand />

      <div className="character-login-visual">
        <AnimatedLoginCharacters
          accountFocused={accountFocused}
          passwordFocused={passwordFocused}
          passwordVisible={passwordVisible}
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
