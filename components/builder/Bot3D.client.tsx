'use client';

import React, { useMemo, useRef, useLayoutEffect, useState } from 'react';
import Image from 'next/image';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';

export type HeadType  = 'round' | 'square' | 'helm';
export type TorsoType = 'capsule' | 'box' | 'barrel';
export type LimbType  = 'segment' | 'tube' | 'spring' | 'none'; // ← allow 'none'
export type EyeStyle  = 'visor' | 'dots';
export type Accessory = 'tie' | 'headset' | null;

export type Bot3DProps = {
  className?: string;
  fitMargin?: number;

  accent?: string;
  shellColor?: string;
  bodyColor?: string;
  trimColor?: string;
  faceColor?: string;

  head?: HeadType;
  torso?: TorsoType;
  arms?: LimbType;   // may be 'none'
  legs?: LimbType;   // may be 'none'
  eyes?: EyeStyle;

  antenna?: boolean;
  withBody?: boolean;

  accessory?: Accessory;
  exploded?: boolean;

  idle?: boolean;
};

const damp = THREE.MathUtils.damp;

function roundedShape(w:number,h:number,r:number){
  const x=-w/2, y=-h/2, rr=Math.min(r,Math.min(w,h)/2);
  const s=new THREE.Shape();
  s.moveTo(x+rr,y);
  s.lineTo(x+w-rr,y); s.quadraticCurveTo(x+w,y,x+w,y+rr);
  s.lineTo(x+w,y+h-rr); s.quadraticCurveTo(x+w,y+h,x+w-rr,y+h);
  s.lineTo(x+rr,y+h); s.quadraticCurveTo(x,y+h,x,y+h-rr);
  s.lineTo(x,y+rr); s.quadraticCurveTo(x,y,x+rr,y);
  return s;
}

function useMaterials(colors: Required<Pick<Bot3DProps,'shellColor'|'bodyColor'|'trimColor'|'faceColor'|'accent'>>){
  const mShell = useMemo(()=>new THREE.MeshStandardMaterial({ color:colors.shellColor, metalness:0.9,  roughness:0.25 }),[colors.shellColor]);
  const mBody  = useMemo(()=>new THREE.MeshStandardMaterial({ color:colors.bodyColor,  metalness:0.85, roughness:0.35 }),[colors.bodyColor]);
  const mTrim  = useMemo(()=>new THREE.MeshStandardMaterial({ color:colors.trimColor,  metalness:0.8,  roughness:0.45 }),[colors.trimColor]);
  const mFace  = useMemo(()=>new THREE.MeshStandardMaterial({ color:colors.faceColor,  roughness:0.9,  metalness:0.08 }),[colors.faceColor]);
  const mGlow  = useMemo(()=>new THREE.MeshStandardMaterial({ color:colors.accent, emissive:colors.accent, emissiveIntensity:1.1 }),[colors.accent]);
  return { mShell, mBody, mTrim, mFace, mGlow };
}

/* ------------ Parts ------------ */
function Head({
  shape, eyes, mats, antenna, accessory
}:{ shape:HeadType; eyes:EyeStyle; mats:ReturnType<typeof useMaterials>; antenna:boolean; accessory:Accessory }) {
  const gHeadRound  = useMemo(()=>{ const s=new THREE.SphereGeometry(0.56,36,36); s.scale(1,1,0.9); return s; },[]);
  const gHeadSquare = useMemo(()=>new THREE.ExtrudeGeometry(roundedShape(1.22,0.98,0.22),{depth:0.25,bevelEnabled:true,bevelSize:0.04,bevelThickness:0.045,bevelSegments:5}),[]);
  const gHelm       = useMemo(()=>new THREE.CapsuleGeometry(0.38,0.35,16,28),[]);
  const gVisor      = useMemo(()=>new THREE.ExtrudeGeometry(roundedShape(0.98,0.5,0.24),{ depth:0.06 }),[]);
  const gDot        = useMemo(()=>new THREE.SphereGeometry(0.07,20,20),[]);
  const gEye        = useMemo(()=>new THREE.CylinderGeometry(0.045,0.045,0.03,24),[]);
  const gBand       = useMemo(()=>new THREE.TorusGeometry(0.55,0.03,14,40,Math.PI),[]);
  const gMicBar     = useMemo(()=>new THREE.CylinderGeometry(0.02,0.02,0.45,10),[]);

  return (
    <group position={[0, 1.05, 0]}>
      {shape==='round'  && <mesh geometry={gHeadRound}  material={mats.mShell} position={[0,0,0.02]} castShadow />}
      {shape==='square' && <mesh geometry={gHeadSquare} material={mats.mShell} position={[0,0,0.02]} castShadow />}
      {shape==='helm'   && (
        <group>
          <mesh geometry={gHelm} material={mats.mShell} position={[0,0.05,0.07]} castShadow />
          <mesh geometry={gHelm} material={mats.mTrim}  position={[0,0.05,-0.1]} scale={[1.04,1.02,0.7]} />
        </group>
      )}

      {eyes==='visor' && <mesh geometry={gVisor} material={mats.mFace} position={[0, 0.02, 0.4]} />}

      {eyes==='visor' ? (
        <>
          <mesh geometry={gEye} material={mats.mGlow} position={[-0.30, 0.03, 0.46]} rotation={[Math.PI/2,0,0]} />
          <mesh geometry={gEye} material={mats.mGlow} position={[ 0.30, 0.03, 0.46]} rotation={[Math.PI/2,0,0]} />
        </>
      ) : (
        <>
          <mesh geometry={gDot} material={mats.mGlow} position={[-0.26, 0.05, 0.46]} />
          <mesh geometry={gDot} material={mats.mGlow} position={[ 0.26, 0.05, 0.46]} />
        </>
      )}

      {antenna && (
        <group position={[-0.38, 0.5, 0.05]}>
          <mesh material={mats.mTrim}><cylinderGeometry args={[0.04,0.04,0.22,14]} /></mesh>
          <mesh material={mats.mGlow} position={[0,0.15,0]}><sphereGeometry args={[0.06,16,16]} /></mesh>
        </group>
      )}

      {accessory === 'headset' && (
        <group>
          <mesh material={mats.mTrim} position={[0,0.12,-0.05]} rotation={[Math.PI,0,0]}>
            <primitive object={gBand} />
          </mesh>
          <mesh geometry={gMicBar} material={mats.mTrim} position={[0.35,-0.05,0.3]} rotation={[0,0,Math.PI/10]} />
          <mesh material={mats.mTrim} position={[0.55,-0.27,0.35]}><sphereGeometry args={[0.04,16,16]} /></mesh>
        </group>
      )}
    </group>
  );
}

function Torso({ shape, mats, accessory }:{
  shape:TorsoType; mats:ReturnType<typeof useMaterials>; accessory:Accessory;
}) {
  const gCapsule = useMemo(()=>new THREE.CapsuleGeometry(0.33,0.55,12,24),[]);
  const gBox     = useMemo(()=>new THREE.BoxGeometry(0.95,1.0,0.5),[]);
  const gBarrel  = useMemo(()=>new THREE.CapsuleGeometry(0.38,0.35,14,28),[]);
  return (
    <group>
      {shape==='capsule' && <mesh geometry={gCapsule} material={mats.mBody} position={[0,0.32,0]} rotation={[0,Math.PI/2,0]} castShadow />}
      {shape==='box'     && <mesh geometry={gBox}     material={mats.mBody} position={[0,0.32,0]} castShadow />}
      {shape==='barrel'  && <mesh geometry={gBarrel}  material={mats.mBody} position={[0,0.35,0]} castShadow />}

      <mesh material={mats.mGlow} position={[0,0.55,0.28]}><boxGeometry args={[0.6,0.06,0.04]} /></mesh>

      {accessory === 'tie' && (
        <group position={[0,0.38,0.31]}>
          <mesh material={mats.mTrim} position={[0,-0.02,0]}>
            <coneGeometry args={[0.07,0.1,16]} />
          </mesh>
          <mesh material={mats.mTrim} position={[0,-0.17,0]}>
            <boxGeometry args={[0.08,0.28,0.02]} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function Arms({ style, mats }:{ style:LimbType; mats:ReturnType<typeof useMaterials> }) {
  if (style === 'none') return null; // ← skip
  const gShoulder = useMemo(()=>new THREE.SphereGeometry(0.16,24,24),[]);
  const gSegment  = useMemo(()=>new THREE.CapsuleGeometry(0.1,0.22,10,18),[]);
  const gTube     = useMemo(()=>new THREE.CylinderGeometry(0.09,0.09,0.44,20),[]);
  const gHand     = useMemo(()=>new THREE.SphereGeometry(0.11,20,20),[]);
  return (
    <group>
      <mesh geometry={gShoulder} material={mats.mShell} position={[-0.6,0.6,0]} />
      <mesh geometry={gShoulder} material={mats.mShell} position={[ 0.6,0.6,0]} />
      {style==='segment' ? (
        <>
          <mesh geometry={gSegment} material={mats.mShell} position={[-0.6,0.42,0]} rotation={[0,0, 0.2]} />
          <mesh geometry={gSegment} material={mats.mShell} position={[-0.68,0.16,0]} rotation={[0,0, 0.02]} />
        </>
      ) : (
        <mesh geometry={gTube} material={mats.mShell} position={[-0.66,0.25,0]} rotation={[0,0, Math.PI/10]} />
      )}
      <mesh geometry={gHand} material={mats.mTrim} position={[-0.7,-0.03,0]} />
      {style==='segment' ? (
        <>
          <mesh geometry={gSegment} material={mats.mShell} position={[0.6,0.42,0]} rotation={[0,0,-0.2]} />
          <mesh geometry={gSegment} material={mats.mShell} position={[0.68,0.16,0]} rotation={[0,0,-0.02]} />
        </>
      ) : (
        <mesh geometry={gTube} material={mats.mShell} position={[0.66,0.25,0]} rotation={[0,0,-Math.PI/10]} />
      )}
      <mesh geometry={gHand} material={mats.mTrim} position={[0.7,-0.03,0]} />
    </group>
  );
}

function Legs({ style, mats }:{ style:LimbType; mats:ReturnType<typeof useMaterials> }) {
  if (style === 'none') return null; // ← skip
  const gHip    = useMemo(()=>new THREE.BoxGeometry(0.72,0.18,0.42),[]);
  const gThigh  = useMemo(()=>new THREE.CapsuleGeometry(0.12,0.28,10,18),[]);
  const gShin   = useMemo(()=>new THREE.CapsuleGeometry(0.11,0.26,10,18),[]);
  const gSpring = useMemo(()=>new THREE.CylinderGeometry(0.1,0.1,0.24,16,1,true),[]);
  const gFoot   = useMemo(()=>new THREE.BoxGeometry(0.32,0.12,0.42),[]);
  return (
    <group>
      <mesh geometry={gHip} material={mats.mTrim} position={[0,-0.16,0]} />
      {style==='spring' ? (
        <>
          <mesh geometry={gSpring} material={mats.mTrim} position={[-0.24,-0.48,0.02]} />
          <mesh geometry={gSpring} material={mats.mTrim} position={[-0.24,-0.66,0.02]} />
        </>
      ) : (
        <>
          <mesh geometry={gThigh} material={mats.mBody} position={[-0.24,-0.42,0]} />
          <mesh geometry={gShin}  material={mats.mBody} position={[-0.24,-0.66,0.02]} />
        </>
      )}
      <mesh geometry={gFoot} material={mats.mTrim} position={[-0.24,-0.88,0.18]} />
      {style==='spring' ? (
        <>
          <mesh geometry={gSpring} material={mats.mTrim} position={[0.24,-0.48,0.02]} />
          <mesh geometry={gSpring} material={mats.mTrim} position={[0.24,-0.66,0.02]} />
        </>
      ) : (
        <>
          <mesh geometry={gThigh} material={mats.mBody} position={[0.24,-0.42,0]} />
          <mesh geometry={gShin}  material={mats.mBody} position={[0.24,-0.66,0.02]} />
        </>
      )}
      <mesh geometry={gFoot} material={mats.mTrim} position={[0.24,-0.88,0.18]} />
    </group>
  );
}

/* ------------ Complete robot ------------ */
function Robot(ap: Required<Omit<Bot3DProps,'className'|'fitMargin'>>) {
  const mats = useMaterials({
    shellColor: ap.shellColor,
    bodyColor : ap.bodyColor,
    trimColor : ap.trimColor,
    faceColor : ap.faceColor,
    accent    : ap.accent,
  });

  const root = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);

  useFrame((state, dt) => {
    if (!ap.idle) return;
    const t = state.clock.getElapsedTime();
    if (root.current) root.current.position.y = Math.sin(t * 1.2) * 0.012;
    if (head.current) {
      head.current.rotation.y = damp(head.current.rotation.y, Math.sin(t * 0.7) * 0.17, 6, dt);
      head.current.rotation.x = damp(head.current.rotation.x, Math.sin(t * 0.9) * 0.08, 6, dt);
    }
  });

  const EX = ap.exploded ? 1 : 0;

  return (
    <group ref={root} position={[0, 0.02, 0]} scale={[1.15, 1.15, 1.15]}>
      <group ref={head} position={[0, 0.15 + EX * 0.35, EX * -0.05]}>
        <Head shape={ap.head!} eyes={ap.eyes!} mats={mats} antenna={!!ap.antenna} accessory={ap.accessory ?? null} />
      </group>

      {ap.withBody && (
        <>
          <group position={[0, EX * 0.05, 0]}>
            <Torso shape={ap.torso!} mats={mats} accessory={ap.accessory ?? null} />
          </group>
          <group position={[-EX * 0.55, EX * 0.15, 0]}>
            <Arms  style={ap.arms!}  mats={mats} />
          </group>
          <group position={[ EX * 0.55, EX * 0.15, 0]}>
            <Arms  style={ap.arms!}  mats={mats} />
          </group>
          <group position={[0, -EX * 0.25, 0]}>
            <Legs  style={ap.legs!}  mats={mats} />
          </group>
        </>
      )}
    </group>
  );
}

/* ------------ Fit camera ------------ */
function FitCamera({ target, margin=0.02 }:{
  target: React.RefObject<THREE.Object3D>;
  margin?: number;
}) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const g = target.current;
    if (!g || !(camera as any).isPerspectiveCamera) return;

    const cam  = camera as THREE.PerspectiveCamera;
    const box  = new THREE.Box3().setFromObject(g);
    const ctr  = new THREE.Vector3();
    const dim  = new THREE.Vector3();
    box.getCenter(ctr);
    box.getSize(dim);
    dim.multiplyScalar(1 + margin);

    const vFOV          = (cam.fov * Math.PI) / 180;
    const fitHeightDist = dim.y / (2 * Math.tan(vFOV / 2));
    const fitWidthDist  = fitHeightDist / (size.width / size.height);
    const dist          = Math.max(fitHeightDist, fitWidthDist);

    cam.position.set(ctr.x, ctr.y + 0.03, ctr.z + dist + 0.18);
    cam.lookAt(ctr);
    cam.updateProjectionMatrix();
  }, [camera, size, target, margin]);
  return null;
}

/* ------------ Drag rotate ------------ */
function DragRotate({ children }:{ children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null!);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const vel = useRef(0);
  const target = useRef(0.25);

  useFrame((_, dt) => {
    const g = ref.current; if (!g) return;
    g.rotation.y += (target.current - g.rotation.y) * Math.min(1, dt * 12);
    if (!dragging.current) {
      if (Math.abs(vel.current) > 0.00015) {
        target.current += vel.current;
        vel.current *= Math.pow(0.05, dt);
      } else {
        vel.current = 0;
      }
    }
  });

  const down = (e: any) => {
    dragging.current = true;
    lastX.current = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    e.currentTarget?.setPointerCapture?.(e.pointerId);
  };
  const move = (e: any) => {
    if (!dragging.current) return;
    const x  = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const dx = x - lastX.current;
    lastX.current = x;
    const d = -dx * 0.005;
    target.current += d;
    vel.current = d;
  };
  const up = (e: any) => {
    dragging.current = false;
    e.currentTarget?.releasePointerCapture?.(e.pointerId);
  };

  return (
    <group
      ref={ref}
      rotation-y={0.25}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
    >
      {children}
    </group>
  );
}

/* ------------ Exported component (default) ------------ */
export default function Bot3D({
  className = 'h-56 w-full',
  fitMargin = 0.02,

  accent    = '#6af7d1',
  shellColor= '#f2f5f8',
  bodyColor = '#cfd6de',
  trimColor = '#aab4bd',
  faceColor = '#0f1418',

  head='round',
  torso='capsule',
  arms='segment',
  legs='segment',
  eyes='visor',

  antenna=true,
  withBody=true,

  accessory=null,
  exploded=false,

  idle=true,
}: Bot3DProps) {
  const fitGroup = useRef<THREE.Group>(null!);

  return (
    <div className={className} role="img" aria-label="3D robot (drag to rotate)">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.05, 2.2], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        shadows
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          scene.background = null;
        }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[ 3, 3.2,  2]} intensity={1.2} castShadow />
        <directionalLight position={[-2, 1.8, -2.2]} intensity={0.5} color={'#c8fff0'} />

        {/* ground blur shadow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.0, 0]} receiveShadow>
          <circleGeometry args={[2.4, 48]} />
          <meshStandardMaterial color="#0f1212" roughness={0.98} metalness={0.05} />
        </mesh>

        <DragRotate>
          <group ref={fitGroup}>
            <Robot
              accent={accent}
              shellColor={shellColor}
              bodyColor={bodyColor}
              trimColor={trimColor}
              faceColor={faceColor}
              head={head}
              torso={torso}
              arms={arms}
              legs={legs}
              eyes={eyes}
              antenna={antenna}
              withBody={withBody}
              accessory={accessory}
              exploded={exploded}
              idle={idle}
            />
          </group>
        </DragRotate>

        <FitCamera target={fitGroup} margin={fitMargin} />
      </Canvas>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Card preview helper (same file, no new components/files).
   Use this in your dashboard cards: it tries <Image>, falls back to Bot3D.
   ────────────────────────────────────────────────────────────── */
export function BotCardPreview({
  src,
  className = 'w-full h-[140px]',
  alt = '',
}: {
  src?: string;
  className?: string;
  alt?: string;
}) {
  const [showImg, setShowImg] = useState(Boolean(src));

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
    >
      {showImg && src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover"
          onError={() => setShowImg(false)}  // ← fallback if broken or 404
          unoptimized
        />
      ) : (
        <div className="absolute inset-0">
          <Bot3D
            className="h-full w-full pointer-events-none"
            accent="var(--brand)"
            head="round"
            torso="capsule"
            arms="segment"
            legs="segment"
            eyes="visor"
            withBody
            antenna
            idle
          />
        </div>
      )}
    </div>
  );
}
