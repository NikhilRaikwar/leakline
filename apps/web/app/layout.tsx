import './globals.css';
export const metadata = {
  title: 'Leakline — Dataset integrity for AI engineers',
  description: 'Inspect public dataset splits, investigate confirmed duplicate components with FalkorDB, and review evidence-backed repair plans.',
  openGraph: {
    title: 'Leakline — Dataset integrity for AI engineers',
    description: 'Know what is connected before you trust your evaluation.',
    type: 'website',
  },
};
export default function RootLayout({children}: Readonly<{children:React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
