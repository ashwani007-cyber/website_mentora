import React, { useState } from 'react';
import { WalletTransaction } from '../types';
import { INITIAL_TRANSACTIONS } from '../data/mockData';
import { Wallet, ArrowUpRight, ArrowDownLeft, ShieldCheck, PlusCircle, CreditCard, DollarSign, History, CheckCircle2, Building2 } from 'lucide-react';

interface WalletProps {
  balance: number;
  onAddFunds: (amount: number) => void;
  transactions: WalletTransaction[];
}

export const WalletView: React.FC<WalletProps> = ({
  balance,
  onAddFunds,
  transactions,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('2000');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(depositAmount);
    if (!isNaN(val) && val > 0) {
      onAddFunds(val);
      setShowAddModal(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-white space-y-8">
      
      {/* Title */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
            App Mechanism & Payments
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
          Mentora Wallet Dashboard
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Seamless wallet-based booking payment & 10–15% platform commission system.
        </p>
      </div>

      {/* Wallet Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Client Available Balance Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Available Client Balance</span>
            <span className="bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              Active UPI Wallet
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-3xl sm:text-4xl font-black text-amber-400">
              ₹{balance.toLocaleString('en-IN')}
            </span>
            <p className="text-xs text-slate-400">Instant checkout for senior advisory sessions.</p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 py-3 rounded-2xl font-bold text-xs shadow-md transition-colors"
          >
            <PlusCircle className="w-4 h-4 fill-slate-950" />
            <span>Add Funds to Wallet</span>
          </button>
        </div>

        {/* Senior Professional Payout Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Senior Expert Earnings</span>
            <span className="bg-amber-500/20 text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30">
              Retirement Payout
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-3xl sm:text-4xl font-black text-emerald-400">
              ₹4,375.00
            </span>
            <p className="text-xs text-slate-400">Net earnings after 12.5% platform commission cut.</p>
          </div>

          <button
            onClick={() => setShowWithdrawModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-2xl font-bold text-xs border border-slate-700 transition-colors"
          >
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>Withdraw to Bank Account</span>
          </button>
        </div>

        {/* Commission Engine Overview Card (PDF Section 4 #1) */}
        <div className="bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 p-6 rounded-3xl border border-amber-500/30 shadow-xl space-y-4">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Platform Revenue Model</span>
            <span className="bg-amber-500/20 text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30">
              PDF Spec #4.1
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-3xl sm:text-4xl font-black text-amber-400">
              10–15%
            </span>
            <p className="text-xs text-slate-300">Commission model per transaction automatically split upon session completion.</p>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Standard Pro Fee:</span>
              <span className="text-white font-bold">15%</span>
            </div>
            <div className="flex justify-between">
              <span>Silver Prime Pro Fee:</span>
              <span className="text-emerald-400 font-bold">10%</span>
            </div>
          </div>
        </div>

      </div>

      {/* Transaction History Ledger */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            Transaction History Ledger
          </h3>
          <span className="text-xs text-slate-400">{transactions.length} Transactions Logged</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Date & Time</th>
                <th className="p-3">Type</th>
                <th className="p-3">Description</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="p-3 font-mono text-slate-400">{tx.date}</td>
                  <td className="p-3 capitalize font-bold">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                      tx.type === 'deposit' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-amber-300 border border-slate-700'
                    }`}>
                      {tx.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-slate-200">{tx.description}</td>
                  <td className={`p-3 text-right font-bold text-sm ${tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tx.amount > 0 ? `+₹${tx.amount}` : `-₹${Math.abs(tx.amount)}`}
                  </td>
                  <td className="p-3 text-center">
                    <span className="text-emerald-400 font-semibold flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Funds Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-amber-400" />
              Add Money to Wallet
            </h3>

            <form onSubmit={handleDepositSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                  Enter Amount (₹)
                </label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-lg"
                />
              </div>

              <div className="flex gap-2">
                {['1000', '2000', '5000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositAmount(amt)}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold border border-slate-700"
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-sm"
              >
                Proceed via UPI / NetBanking
              </button>
            </form>

            <button
              onClick={() => setShowAddModal(false)}
              className="w-full py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 text-center">
            <Building2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-xl font-bold text-white">Initiate Bank Payout</h3>
            <p className="text-xs text-slate-300">
              Payout of <strong className="text-emerald-400">₹4,375.00</strong> will be credited directly to your registered bank account (State Bank of India •••• 4092).
            </p>
            <button
              onClick={() => {
                alert("Bank payout initiated successfully! Funds will reflect in 24 hours.");
                setShowWithdrawModal(false);
              }}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-sm"
            >
              Confirm Withdrawal
            </button>
            <button
              onClick={() => setShowWithdrawModal(false)}
              className="w-full py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
