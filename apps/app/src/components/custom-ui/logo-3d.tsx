"use client"

import { useRef } from "react"
import { Canvas, useFrame, useLoader } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"
import { TextureLoader, MeshStandardMaterial } from "three"
import type * as THREE from "three"
import { cn } from "@/lib/utils"
import { motion } from "motion/react"
import { easeOut } from "motion"

function LogoBox() {
  const meshRef = useRef<THREE.Mesh>(null)
  const texture = useLoader(TextureLoader, "/clawpay-logo.png")

  // Create materials array: [+x, -x, +y, -y, +z (front), -z (back)]
  // Edges get a solid dark color, front/back get the logo texture
  const edgeMaterial = new MeshStandardMaterial({ color: "#000000", metalness: 0.3, roughness: 0.4 })
  const logoMaterial = new MeshStandardMaterial({ map: texture, metalness: 0.2, roughness: 0.5 })
  const materials = [
    edgeMaterial, // right edge
    edgeMaterial, // left edge
    edgeMaterial, // top edge
    edgeMaterial, // bottom edge
    logoMaterial, // front face
    logoMaterial, // back face
  ]

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.3
    }
  })

  return (
    <mesh ref={meshRef} castShadow receiveShadow material={materials}>
      <boxGeometry args={[4, 4, 0.5]} />
    </mesh>
  )
}


export default function Logo3D({ className, delay = 0, duration = 1.2 }: { className?: string; delay?: number; duration?: number }) {
  return (
    <div className={cn("w-full h-full rounded-lg overflow-hidden relative", className)}>
      <motion.div
        className="absolute inset-0 bg-card rounded-lg"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.4, ease: easeOut, delay }}
        style={{ transformOrigin: "center" }}
      />
      <motion.div
        className="absolute inset-0 w-full h-full"
        initial={{ opacity: 0, filter: "blur(16px) saturate(0.9)" }}
        animate={{ opacity: 1, filter: "blur(0px) saturate(1)" }}
        transition={{ duration, delay: delay + 0.4, ease: easeOut }}
      >
        <Canvas camera={{ position: [0, 0, 8], fov: 50 }} gl={{ antialias: true }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[10, 10, 5]} intensity={1.2} />
          <directionalLight position={[-10, -10, -5]} intensity={0.6} />
          <LogoBox />
          <OrbitControls enableZoom={true} enablePan={false} minDistance={5} maxDistance={15} />
          <Environment files="/studio_small_03_1k.hdr" />
        </Canvas>
      </motion.div>
    </div>
  )
}
