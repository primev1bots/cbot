import React, { useState } from "react";
import { Coins, Wallet, KeyRound, Gem, ArrowLeft } from "lucide-react";
import { UserData } from "../App";

interface SpinPageProps {
  onBack: () => void;
  user: UserData | null;
  updateUserData: (updates: Partial<UserData>) => void;
}

const SpinPage: React.FC<SpinPageProps> = ({ onBack, user, updateUserData }) => {
  const costCoins = 100;
  const costKeys = 1;
  const canSpin = (user?.coins || 0) >= costCoins && (user?.keys || 0) >= costKeys;

  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [centerText, setCenterText] = useState("SPIN IT!");
  const [totalRotation, setTotalRotation] = useState(0);

  // Updated prizes with exact specifications
  const prizes = [
    '1$',        // 0.40% chance
    '0.50$',     // 0.60% chance  
    '0.02$',     // 4% chance
    '0.01$',     // 10% chance
    '0.005$',    // 25% chance
    '100 Coin',  // 20% chance
    '50 Coin',   // 20% chance
    '1 Key'      // 20% chance
  ];

  // Exact weights as percentages (multiplied by 100 for precision)
  const weights = [40, 60, 400, 1000, 2500, 2000, 2000, 2000]; // Total: 10000 (100%)

  const segmentCount = prizes.length;
  const segmentAngle = 360 / segmentCount;

  const pickWeightedIndex = (weights: number[]) => {
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    let acc = 0;
    for (let i = 0; i < weights.length; i++) {
      acc += weights[i];
      if (r < acc) return i;
    }
    return weights.length - 1;
  };

  const handleSpin = () => {
    if (spinning || !canSpin || !user) return;

    setSpinning(true);
    setCenterText('WAIT...');
    setResult(null);

    const chosenIndex = pickWeightedIndex(weights);
    const targetSegmentCenter = chosenIndex * segmentAngle + segmentAngle / 2;
    const baseRotation = -targetSegmentCenter - 270;
    const fullRotations = 5;
    const extraRotation = fullRotations * 360;

    const newRotation = totalRotation + extraRotation + baseRotation;
    setTotalRotation(newRotation);

    setTimeout(() => {
      const prize = prizes[chosenIndex];
      setCenterText(prize);
      setResult(prize);

      let updates: Partial<UserData> = {
        coins: user.coins - costCoins,
        keys: user.keys - costKeys
      };

      // Handle different prize types
      if (prize.includes('$')) {
        const amount = parseFloat(prize.replace('$', '').trim());
        updates.balance = user.balance + amount;
        updates.totalEarned = user.totalEarned + amount;
      } else if (prize.includes('Coin')) {
        const coinAmount = parseInt(prize.replace('Coin', '').trim());
        updates.coins = (user.coins - costCoins) + coinAmount;
      } else if (prize.includes('Key')) {
        const keyAmount = parseInt(prize.replace('Key', '').trim()) || 1;
        updates.keys = (user.keys - costKeys) + keyAmount;
      }

      updateUserData(updates);

      setTimeout(() => {
        setTotalRotation(0);
        setSpinning(false);
        setCenterText("SPIN IT!");
      }, 1000);
    }, 4000);
  };

  return (
    <div className="min-h-screen flex justify-center bg-gradient-to-b from-[#f8fafc] to-[#f1f5f9] safe-area-bottom">
      <div className="w-full max-w-xl px-4 pt-4 md:pt-6 pb-32 md:pb-24">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-3 rounded-2xl bg-white/80 backdrop-blur-lg border border-gray-200 hover:bg-white transition-all duration-300 shadow-sm hover:shadow-md group"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-gray-700 group-hover:text-blue-600" />
            <span className="text-sm font-medium text-gray-700 hidden xs:block">Back</span>
          </button>

          <div className="text-center">
            <p className="text-lg md:text-2xl font-extrabold text-gray-900 tracking-wide">
              🎡 Spin & Win
            </p>
            <p className="text-xs md:text-sm text-gray-600 mt-1">Spin the wheel and win amazing prizes!</p>
          </div>

          <div className="w-12 md:w-20" />
        </div>

        <div className="bg-[#ffffffcc] backdrop-blur-md rounded-2xl border border-white/40 shadow-md p-3 md:p-4 mb-4 md:mb-6">
          <div className="flex justify-around text-xs md:text-sm font-semibold">
            <div className="flex items-center gap-1 md:gap-2 text-amber-600">
              <Coins className="w-4 h-4 md:w-5 md:h-5" />
              <span>{user?.coins || 0} Coin</span>
            </div>
            <div className="flex items-center gap-1 md:gap-2 text-emerald-600">
              <Wallet className="w-4 h-4 md:w-5 md:h-5" />
              <span>$ {(user?.balance || 0).toFixed(4)}</span>
            </div>
            <div className="flex items-center gap-1 md:gap-2 text-blue-600">
              <KeyRound className="w-4 h-4 md:w-5 md:h-5" />
              <span>{user?.keys || 0} Key</span>
            </div>
            <div className="flex items-center gap-1 md:gap-2 text-purple-600">
              <Gem className="w-4 h-4 md:w-5 md:h-5" />
              <span>{user?.diamonds || 0}</span>
            </div>
          </div>
        </div>

        <div className="text-center mb-4 md:mb-6">
          <p className="text-xs md:text-sm text-gray-600">
            Cost per Spin:{" "}
            <span className="font-bold text-amber-600">{costCoins} Coins</span>{" "}
            and{" "}
            <span className="font-bold text-blue-600">{costKeys} Key</span>
          </p>
        </div>

        <div className="mt-4 flex flex-col items-center">
          <div className="wheel-area relative" style={{ position: 'relative', width: '280px', height: '280px' }}>
            {/* Pointer arrow */}
            <div
              className="pointer"
              style={{
                width: 0,
                height: 0,
                borderLeft: '15px solid transparent',
                borderRight: '15px solid transparent',
                borderTop: '25px solid #ff0000',
                position: 'absolute',
                top: '-15px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 20,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
              }}
            ></div>

            {/* Wheel */}
            <div
              className="wheel"
              style={{
                width: '280px',
                height: '280px',
                borderRadius: '50%',
                background: 'conic-gradient(' +
                  '#ff6b6b 0deg 45deg, ' +      // 1$ - Red
                  '#ffa726 45deg 90deg, ' +     // 0.50$ - Orange  
                  '#4ecdc4 90deg 135deg, ' +    // 0.02$ - Teal
                  '#45b7d1 135deg 180deg, ' +   // 0.01$ - Light Blue
                  '#96ceb4 180deg 225deg, ' +   // 0.005$ - Green
                  '#feca57 225deg 270deg, ' +   // 100 Coin - Yellow
                  '#ff9ff3 270deg 315deg, ' +   // 50 Coin - Pink
                  '#54a0ff 315deg 360deg' +     // 1 Key - Blue
                  ')',
                position: 'relative',
                transition: 'transform 4s cubic-bezier(0.25, 0.1, 0.05, 1)',
                overflow: 'hidden',
                transform: `rotate(${totalRotation}deg)`
              }}
            >
              {/* Prize labels - positioned EXACTLY like reference image */}
              <div className="label" style={{ '--deg': '22.5deg' } as React.CSSProperties}>
                <span>$1</span>
              </div>
              <div className="label" style={{ '--deg': '67.5deg' } as React.CSSProperties}>
                <span>$0.50</span>
              </div>
              <div className="label" style={{ '--deg': '112.5deg' } as React.CSSProperties}>
                <span>$0.02</span>
              </div>
              <div className="label" style={{ '--deg': '157.5deg' } as React.CSSProperties}>
                <span>$0.01</span>
              </div>
              <div className="label" style={{ '--deg': '202.5deg' } as React.CSSProperties}>
                <span>$0.005</span>
              </div>
              <div className="label" style={{ '--deg': '247.5deg' } as React.CSSProperties}>
                <span>100 Coin</span>
              </div>
              <div className="label" style={{ '--deg': '292.5deg' } as React.CSSProperties}>
                <span>50 Coin</span>
              </div>
              <div className="label" style={{ '--deg': '337.5deg' } as React.CSSProperties}>
                <span>1 Key</span>
              </div>
            </div>

            {/* Center circle */}
            <div
              className="center"
              style={{
                position: 'absolute',
                width: '100px',
                height: '100px',
                background: '#ffd600',
                borderRadius: '50%',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'pointer',
                boxShadow: '0 0 10px rgba(0,0,0,0.6)'
              }}
            >
              <span style={{
                fontSize: '16px',
                fontWeight: 900,
                color: '#000',
                textAlign: 'center',
                padding: '0 8px'
              }}>
                {centerText}
              </span>
            </div>
          </div>

          <button
            onClick={handleSpin}
            disabled={!canSpin || spinning}
            className={`mt-6 md:mt-8 w-full max-w-sm py-3 md:py-4 rounded-2xl text-base md:text-lg font-semibold transition-all duration-300 shadow-lg ${canSpin ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white hover:scale-105 hover:shadow-xl" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
          >
            {spinning ? "Spinning..." : canSpin ? "🎡 Spin Now!" : "Insufficient Balance"}
          </button>

          {result && (
            <div className="mt-4 p-3 md:p-4 bg-green-100 border border-green-400 rounded-2xl">
              <p className="text-green-800 font-bold text-center text-sm md:text-base">
                Congratulations! You won: {result}
              </p>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .wheel-area {
          position: relative;
          width: 280px;
          height: 280px;
        }

        .pointer {
          width: 0;
          height: 0;
          border-left: 15px solid transparent;
          border-right: 15px solid transparent;
          border-top: 25px solid #ff0000;
          position: absolute;
          top: -15px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        }

        .wheel {
          width: 280px;
          height: 280px;
          border-radius: 50%;
          background: conic-gradient(
            #ff6b6b 0deg 45deg, 
            #ffa726 45deg 90deg, 
            #4ecdc4 90deg 135deg, 
            #45b7d1 135deg 180deg, 
            #96ceb4 180deg 225deg, 
            #feca57 225deg 270deg, 
            #ff9ff3 270deg 315deg, 
            #54a0ff 315deg 360deg
          );
          position: relative;
          transition: transform 4s cubic-bezier(0.25, 0.1, 0.05, 1);
          overflow: hidden;
        }

        .label {
          position: absolute;
          left: 50%;
          top: 50%;
          transform-origin: 50% 50%;
          z-index: 5;
          transform: rotate(var(--deg));
        }

        .label span {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-110px, -50%) rotate(calc(-1 * var(--deg)));
          font-size: 14px;
          font-weight: bold;
          color: #fff;
          white-space: nowrap;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
        }

        .center {
          position: absolute;
          width: 100px;
          height: 100px;
          background: #ffd600;
          border-radius: 50%;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 10;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(0,0,0,0.6);
        }

        .center span {
          font-size: 16px;
          font-weight: 900;
          color: #000;
          text-align: center;
          padding: 0 8px;
        }

        @media (min-width: 640px) {
          .wheel-area {
            width: 350px;
            height: 350px;
          }
          
          .wheel {
            width: 350px;
            height: 350px;
          }
          
          .label span {
            transform: translate(-140px, -50%) rotate(calc(-1 * var(--deg)));
            font-size: 16px;
          }
          
          .center {
            width: 140px;
            height: 140px;
          }
          
          .center span {
            font-size: 22px;
          }
          
          .pointer {
            border-left: 20px solid transparent;
            border-right: 20px solid transparent;
            border-top: 30px solid #ff0000;
            top: -20px;
          }
        }
      `}</style>
    </div>
  );
};

export default SpinPage;