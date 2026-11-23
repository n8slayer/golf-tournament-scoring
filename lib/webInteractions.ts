import { Platform } from 'react-native';
import { colors } from './styles';

// Web only: one hover / press / focus layer for every button, tab and link (React Native Web
// renders Pressables as role="button"/"tab" and links as <a>). Phones use s.pressed.
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('press-layer')) {
  const css = `
[role="button"],[role="tab"],[role="radio"],a{transition:transform .14s ease,filter .14s ease,box-shadow .14s ease;cursor:pointer}
@media (hover:hover){
  [role="button"]:hover,[role="tab"]:hover,[role="radio"]:hover,a:hover{filter:brightness(1.12)}
  a[href]:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.35)}
}
[role="button"]:active,[role="tab"]:active,[role="radio"]:active,a:active{transform:scale(.98);filter:brightness(.95)}
:focus-visible{outline:2px solid ${colors.accent};outline-offset:2px}
[aria-disabled="true"]{cursor:default;filter:none!important;transform:none!important}
@media (prefers-reduced-motion:reduce){[role="button"],[role="tab"],[role="radio"],a{transition:none;transform:none!important}}
`;
  const el = document.createElement('style');
  el.id = 'press-layer';
  el.textContent = css;
  document.head.appendChild(el);
}
