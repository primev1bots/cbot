import React, { useState, useEffect } from "react";
import { Wallet } from "lucide-react";
import { ref, get, set, push } from 'firebase/database';
import { database } from "../App";
import { UserData, WithdrawHistory } from "../App";

const minWithdraw = {
  bkash: 1,      // $1 minimum
  nagad: 1.5,    // $1.5 minimum
  rocket: 2,     // $2 minimum
};

interface ProfilePageProps {
  user: UserData | null;
  updateUserData: (updates: Partial<UserData>) => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user, updateUserData }) => {
  const [paymentMethod, setPaymentMethod] = useState("");
  const [accountId, setAccountId] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawHistory, setWithdrawHistory] = useState<WithdrawHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const displayName = user?.firstName + (user?.lastName ? ` ${user.lastName}` : "");
  const userInitials = user?.firstName?.charAt(0) + (user?.lastName?.charAt(0) || "");

  // Load withdraw history
  useEffect(() => {
    if (user) {
      loadWithdrawHistory();
    }
  }, [user]);

  const loadWithdrawHistory = async () => {
    if (!user) return;
    
    setLoadingHistory(true);
    try {
      const withdrawRef = ref(database, `withdraws/${user.telegramId}`);
      const snapshot = await get(withdrawRef);
      
      if (snapshot.exists()) {
        const historyData = snapshot.val();
        const historyArray: WithdrawHistory[] = Object.keys(historyData).map(key => ({
          id: key,
          ...historyData[key]
        }));
        
        // Sort by creation date (newest first)
        historyArray.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setWithdrawHistory(historyArray);
      } else {
        setWithdrawHistory([]);
      }
    } catch (error) {
      console.error('Error loading withdraw history:', error);
      setWithdrawHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user || !paymentMethod || !accountId || !withdrawAmount) {
      alert("Please fill all fields");
      return;
    }

    const amount = parseFloat(withdrawAmount);
    
    // Check minimum withdraw amount
    const minAmount = minWithdraw[paymentMethod as keyof typeof minWithdraw];
    if (amount < minAmount) {
      alert(`Minimum withdraw for ${paymentMethod} is $${minAmount}`);
      return;
    }

    if (amount > user.balance) {
      alert("Insufficient balance");
      return;
    }

    try {
      // Create withdraw record
      const withdrawRef = ref(database, `withdraws/${user.telegramId}`);
      const newWithdrawRef = push(withdrawRef);
      
      const withdrawData: WithdrawHistory = {
        id: newWithdrawRef.key!,
        telegramId: user.telegramId,
        amount: amount,
        paymentMethod: paymentMethod,
        accountId: accountId,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await set(newWithdrawRef, withdrawData);

      // Update user balance (deduct the withdrawn amount)
      const updates: Partial<UserData> = {
        balance: user.balance - amount
      };

      await updateUserData(updates);
      
      // Reload history
      await loadWithdrawHistory();
      
      alert("Withdrawal request submitted successfully!");
      
      // Reset form
      setPaymentMethod("");
      setAccountId("");
      setWithdrawAmount("");
      
    } catch (error) {
      console.error('Error processing withdraw:', error);
      alert("Failed to process withdrawal. Please try again.");
    }
  };

  const handleReset = () => {
    setPaymentMethod("");
    setAccountId("");
    setWithdrawAmount("");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-500/20 border-green-500/30';
      case 'rejected': return 'text-red-600 bg-red-500/20 border-red-500/30';
      default: return 'text-yellow-600 bg-yellow-500/20 border-yellow-500/30';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      default: return 'Pending';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="px-4 mt-4 md:mt-6 pb-32 md:pb-40">

      {/* Main card */}
      <div className="bg-[#ffffffcc] backdrop-blur-md rounded-2xl border border-white/40 shadow-md p-3 md:p-4">
        {/* Profile section */}
        <div className="flex flex-col items-center mb-4 md:mb-5">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-white shadow-md mb-2">
            {user?.photoUrl ? (
              <img
                src={user.photoUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback if image fails to load
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div className={`w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg md:text-xl ${user?.photoUrl ? 'hidden' : 'flex'}`}>
              {userInitials}
            </div>
          </div>
          <p className="text-[14px] md:text-[16px] font-semibold text-gray-900">{displayName}</p>
          {user?.username && (
            <p className="text-[10px] md:text-[11px] text-gray-500 mt-0.5">@{user.username}</p>
          )}
          <p className="text-[10px] md:text-[11px] text-gray-500 mt-0.5">ID: {user?.telegramId}</p>
        </div>

        {/* Join Date + Total Earned */}
        <div className="flex items-center justify-between bg-white/80 rounded-2xl border border-gray-200 px-3 py-2 md:px-4 md:py-3 mb-4 md:mb-5">
          
          {/* Join Date */}
          <div>
            <p className="text-[10px] md:text-[11px] text-gray-500">Join Date</p>
            <p className="text-[13px] md:text-[15px] font-semibold text-gray-900 mt-0.5">
              {user ? new Date(user.joinDate).toLocaleDateString() : "N/A"}
            </p>
          </div>

          <div className="h-7 md:h-9 w-px bg-gray-200" />

          {/* Total Earned */}
          <div className="text-center">
            <p className="text-[10px] md:text-[11px] text-gray-500">Total Earned</p>
            <p className="text-[13px] md:text-[15px] font-semibold text-gray-900 mt-0.5">
              ${user?.balance.toFixed(2) || "0.00"}
            </p>
          </div>

        </div>

        {/* Withdraw form */}
        <div className="mb-4 md:mb-5">
          <p className="text-[12px] md:text-[13px] font-semibold text-gray-900 mb-2 md:mb-3">
            Withdraw Money
          </p>

          {/* Payment Method */}
          <div className="mb-2 md:mb-3">
            <label className="block text-[10px] md:text-[11px] text-gray-500 mb-1">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                // Reset amount when payment method changes
                setWithdrawAmount("");
              }}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-[12px] md:text-[13px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="" disabled>
                Select Payment Method
              </option>
              <option value="bkash">bKash</option>
              <option value="nagad">Nagad</option>
              <option value="rocket">Rocket</option>
            </select>
          </div>

          {/* Account ID */}
          <div className="mb-2 md:mb-3">
            <label className="block text-[10px] md:text-[11px] text-gray-500 mb-1">
              Account Number
            </label>
            <input
              type="text"
              placeholder="Enter your account number"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-[12px] md:text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Amount */}
          <div className="mb-3 md:mb-4">
            <label className="block text-[10px] md:text-[11px] text-gray-500 mb-1">
              Amount (USD)
            </label>

            <input
              type="number"
              step="0.01"
              min="0"
              placeholder={`Min $${paymentMethod ? minWithdraw[paymentMethod as keyof typeof minWithdraw] : 0}`}
              value={withdrawAmount}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                const min = paymentMethod ? minWithdraw[paymentMethod as keyof typeof minWithdraw] : 0;

                if (value < min && paymentMethod) {
                  setWithdrawAmount(min.toString());
                } else {
                  setWithdrawAmount(e.target.value);
                }
              }}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-[12px] md:text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            {paymentMethod && (
              <p className="text-[10px] text-red-500 mt-1">
                Minimum withdraw for <strong>{paymentMethod}</strong> is{" "}
                {formatCurrency(minWithdraw[paymentMethod as keyof typeof minWithdraw])}
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={handleReset}
              className="flex-1 py-2 md:py-2.5 rounded-full border border-gray-300 text-[12px] md:text-[13px] font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={handleWithdraw}
              disabled={!paymentMethod || !accountId || !withdrawAmount || parseFloat(withdrawAmount) > (user?.balance || 0)}
              className="flex-1 py-2 md:py-2.5 rounded-full bg-indigo-500 text-[12px] md:text-[13px] font-semibold text-white shadow-md hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* Withdraw History card */}
      <div className="mt-3 md:mt-4 bg-[#ffffffcc] backdrop-blur-md rounded-2xl border border-white/40 shadow-md p-3 md:p-4">
        <div className="flex items-center justify-between mb-2 md:mb-3">
          <p className="text-[12px] md:text-[13px] font-semibold text-gray-900">
            Withdraw History
          </p>
          <button 
            onClick={loadWithdrawHistory}
            className="text-[10px] md:text-[11px] text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Refresh
          </button>
        </div>
        
        {loadingHistory ? (
          <div className="flex items-center justify-center py-6 md:py-8">
            <div className="w-6 h-6 md:w-8 md:h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-2 text-gray-600 text-xs md:text-sm">Loading history...</span>
          </div>
        ) : withdrawHistory.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 py-8 md:py-12 flex flex-col items-center justify-center bg-white/70">
            <Wallet className="w-8 h-8 md:w-10 md:h-10 text-gray-400 mb-2" />
            <p className="text-[10px] md:text-[11px] text-gray-500 text-center">
              No withdrawal history found.
              <br />
              <span className="text-[9px] text-gray-400">Your withdrawal requests will appear here</span>
            </p>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-3 max-h-60 md:max-h-80 overflow-y-auto">
            {withdrawHistory.map((withdraw) => (
              <div
                key={withdraw.id}
                className="bg-white/80 rounded-xl p-3 md:p-4 border border-gray-200 hover:border-gray-300 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-1 md:mb-2">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs md:text-sm">
                      {withdraw.paymentMethod.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[11px] md:text-[12px] font-semibold text-gray-900 capitalize">
                        {withdraw.paymentMethod}
                      </p>
                      <p className="text-[9px] md:text-[10px] text-gray-500">
                        {withdraw.accountId}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-[11px] md:text-[12px] font-bold text-gray-900">
                      {formatCurrency(withdraw.amount)}
                    </p>
                    <span className={`text-[9px] md:text-[10px] font-medium px-1.5 py-0.5 rounded border ${getStatusColor(withdraw.status)}`}>
                      {getStatusText(withdraw.status)}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-[9px] md:text-[10px] text-gray-500">
                  <span>
                    {new Date(withdraw.createdAt).toLocaleDateString()}
                  </span>
                  <span>
                    {new Date(withdraw.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                
                {withdraw.adminNotes && (
                  <div className="mt-1 md:mt-2 p-1.5 md:p-2 bg-yellow-50 rounded border border-yellow-200">
                    <p className="text-[9px] md:text-[10px] text-yellow-700">
                      <strong>Note:</strong> {withdraw.adminNotes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;