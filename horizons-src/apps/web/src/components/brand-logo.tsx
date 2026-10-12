const logoImage = 'https://dynamic.design.com/preview/logodraft/b8db6e57-b9f4-4441-80a3-7854e4740550/image/extra-large.png';

export function BrandLogo() {
  return (
    <span className="brand-logo-window">
      <img src={logoImage} alt="SmartSelectLabs" />
    </span>
  );
}
