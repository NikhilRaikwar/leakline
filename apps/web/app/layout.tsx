import './globals.css';
export const metadata = {title:'Leakline — Dataset integrity audit',description:'Public dataset integrity audit and verified repair using FalkorDB connected components.'};
export default function RootLayout({children}: Readonly<{children:React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
