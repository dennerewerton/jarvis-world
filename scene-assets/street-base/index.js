import * as THREE from 'three';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useCleanup, useMaterials, usePhysics} = metaversefile;

export default () => {
  const app = useApp();
  const {WebaverseShaderMaterial} = useMaterials();

  const streetSize = new THREE.Vector3(10, 1, 1000);

  const streetMesh = (() => {
    const material = new WebaverseShaderMaterial({
      uniforms: {
        uTime: {
          type: 'f',
          value: 0,
        },
        /* uBeat: {
          type: 'f',
          value: 1,
        }, */
      },
      vertexShader: `\
        attribute float y;
        attribute vec3 barycentric;
        varying float vUv;
        varying vec3 vBarycentric;
        varying vec3 vPosition;
        void main() {
          vUv = uv.x;
          vBarycentric = barycentric;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `\
        // uniform float uBeat;
        varying vec3 vBarycentric;
        varying vec3 vPosition;
        uniform float uTime;

        struct C{
            float d;
            int t;
        };
            
        float rand2(vec2 co){
            return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
        }

        float rand(vec3 v){
            return rand2(vec2(v.x+v.z,v.y+v.z));
        }

        int wait(float t){
            float period = 4.*3.141592/1.5;
            t = mod(t,period);
            if(t < period/2.){
                if(t < period/8.)return 0;
                if(t < period/4.)return 1;
                return int((t/period-1./4.)*40.)+2;
            }else{
                t-=period/2.;
                if(t < period/8.)return 10;
                if(t < period/4.)return 9;
                return 8-int((t/period-1./4.)*40.);
            }
            return 0;
        }

        float scal(float t){
            float period = 4.*3.141592/1.5;
            t = mod(t,period);
            float base = -1000.0;
            if(t < period/2.){
                if(t < period/8.)base=-1000.0;
                else if(t < period/4.)base=period/8.;
                else if(t<period*(1./4.+9./40.)){
                    int x = int((t/period-1./4.)*40.);
                  base = period*(1./4.+float(x)/40.);
                }
            }else{
                t -= period/2.;
                if(t < period/8.)base=-1000.0;
                else if(t < period/4.)base=period/8.;
                else if(t<period*(1./4.+9./40.)){
                    int x = int((t/period-1./4.)*40.);
                  base = period*(1./4.+float(x)/40.);
                }
            }
            return exp(-(t-base)*10.);
        }

        vec3 transform(vec3 p){
            float t = uTime+sin(uTime*1.5);
            p -= vec3(4,0,0);
            p *= mat3(cos(t),0,sin(t),0,1,0,-sin(t),0,cos(t));
            t *= 1.2;
            t += sin(uTime*0.5);
            p *= mat3(cos(t),sin(t),0,-sin(t),cos(t),0,0,0,1);
            return p;
        }

        float pattern(vec3 p, float section) {
          // p = transform(p);
          /* float s = 1.; // (0.7+scal(uTime)*0.08) / 0.7;
          p /= s;
          p /= 1.3;
          p += 0.5; */
          float d = 0.;
          // float t = uTime;
          vec3 e = vec3(section);
          for(int i=0;i<10;i++){
              // if(wait(t) <= i)break;
              float w = pow(2.,float(i));
              float f;

              f = rand(vec3(0,0,float(i))+e);
              if(p.x < f)e.x+=w;
              else e.x-=w;
              if(pow(max(0.,1.-abs(p.x-f)),90.)*1.5 > 0.5+float(i)/20.)d = 1.;

              f = rand(vec3(1,0,float(i))+e);
              if(p.y < f)e.y+=w;
              else e.y-=w;
              if(pow(max(0.,1.-abs(p.y-f)),90.)*1.5 > 0.5+float(i)/20.)d = 1.;

              f = rand(vec3(2,0,float(i))+e);
              if(p.z < f)e.z+=w;
              else e.z-=w;
              if(pow(max(0.,1.-abs(p.z-f)),90.)*1.5 > 0.5+float(i)/20.)d = 1.;
          }
          return d<1.?0.:1.;
        }

        const vec3 lineColor1 = vec3(${new THREE.Color(0x4fc3f7).toArray().join(', ')});
        // const vec3 lineColor2 = vec3(${new THREE.Color(0x9575cd).toArray().join(', ')});

        vec4 sRGBToLinear( in vec4 value ) {
          return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
        }

        void main() {
          // vec3 c = mix(lineColor1, lineColor2, vPosition.y / 10.);
          vec3 c = lineColor1;
          vec3 p = mod(vec3(vPosition.x*0.99, vPosition.y, vPosition.z)/10. + 0.5, 1.);
          float section = floor(vPosition.z/10.);
          float f = pattern(p, section);
          gl_FragColor = vec4(c * (f > 0.5 ? 1. : 0.2) /* * uBeat */, 1.);
          gl_FragColor = sRGBToLinear(gl_FragColor);

          #include <tonemapping_fragment>
			    #include <encodings_fragment>
        }
      `,
      side: THREE.DoubleSide,

      clipping: false,
      fog: false,
      lights: false,
    });
    const geometry = new THREE.BoxBufferGeometry(streetSize.x, streetSize.y, streetSize.z);
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  })();
  streetMesh.position.set(0, -1/2, 0);
  app.add(streetMesh);
  streetMesh.updateMatrixWorld();

  const physics = usePhysics();
  const floorPhysicsId = physics.addBoxGeometry(
    new THREE.Vector3(0, -streetSize.y/2, 0)
      .applyQuaternion(streetMesh.quaternion),
    streetMesh.quaternion,
    new THREE.Vector3(streetSize.x, streetSize.y, streetSize.z).multiplyScalar(0.5),
    false
  );

  useFrame(({timestamp}) => {
    streetMesh.material.uniforms.uTime.value = (timestamp%10000)/20;
  });
  
  useCleanup(() => {
    physics.removeGeometry(floorPhysicsId);
  });

  return app;
}