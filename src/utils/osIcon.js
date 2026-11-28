import { fieldText } from './metrics.js'

const icons = [
  [/\b(proxmox|pve)\b/i, 'os-proxmox.ico'],
  [/\b(synology|dsm)\b/i, 'os-synology.ico'],
  [/\bistore\s*os\b/i, 'os-istore.png'],
  [/\b(armbian|armbox)\b/i, 'os-armbian.png'],
  [/\b(kali|kail)\b/i, 'os-kail.svg'],
  [/\bmanjaro\b/i, 'os-manjaro-.svg'],
  [/\b(linux mint|mint)\b/i, 'os-mint.svg'],
  [/\b(almalinux|alma linux|alma)\b/i, 'os-alma.svg'],
  [/\b(alpine linux|alpine)\b/i, 'os-alpine.webp'],
  [/\b(centos|cent os)\b/i, 'os-centos.svg'],
  [/\brocky\b/i, 'os-rocky.svg'],
  [/\boracle\b/i, 'os-oracle.svg'],
  [/\b(red hat|redhat|rhel)\b/i, 'os-redhat.svg'],
  [/\b(alibaba|aliyun|alinux|anolis|openanolis)\b|阿里|龙蜥/i, 'os-alibaba.svg'],
  [/\bopencloud(?:\s*os)?\b/i, 'os-opencloud.svg'],
  [/\bfedora\b/i, 'os-fedora.svg'],
  [/\b(opensuse|open suse|suse)\b/i, 'os-openSUSE.svg'],
  [/\bgentoo\b/i, 'os-gentoo.svg'],
  [/\b(nixos|nix os|nix)\b/i, 'os-nix.svg'],
  [/\b(open[ -]?wrt|immortalwrt|immortal)\b/i, 'os-openwrt.svg'],
  [/\b(archlinux|arch linux|arch)\b/i, 'os-arch.svg'],
  [/\b(ubuntu|elementary)\b/i, 'os-ubuntu.svg'],
  [/\b(debian|deb)\b/i, 'os-debian.svg'],
  [/\b(mac\s*os|darwin|os x)\b/i, 'os-macos.svg'],
  [/\b(windows|win32|win64|win10|win11|microsoft)\b/i, 'os-windows.svg']
]

export function osIconUrl(os, base) {
  const name = fieldText(os)
  if (!name) return ''
  const asset = icons.find(([pattern]) => pattern.test(name))?.[1] ?? 'os-unknown.svg'
  return new URL('/os-icons/' + asset, base).href
}
