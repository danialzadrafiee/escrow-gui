"use client"
import React, { useState, useEffect } from "react"
import Web3 from "web3"
import { ThemeProvider, createTheme } from "@mui/material/styles"
import {
  CssBaseline,
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Card,
  CardContent,
  CardActions,
  Tabs,
  Tab,
  Tooltip,
  IconButton,
} from "@mui/material"
import { abi } from "./abi"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import RefreshIcon from "@mui/icons-material/Refresh"

const contractABI = abi
const contractAddress = "0x0325e03db2baA3EDDE0417876333B35e6d467D35"

const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
  },
})

interface EscrowStep {
  amount: string
  approved: boolean
}

interface Escrow {
  id: number
  payer: string
  payee: string
  totalAmount: string
  deadline: number
  isActive: boolean
  completed: boolean
  releasedAmount: string
  steps?: EscrowStep[]
}

function App() {
  const [web3, setWeb3] = useState<Web3 | null>(null)
  const [contract, setContract] = useState<any>(null)
  const [account, setAccount] = useState<string>("")
  const [escrows, setEscrows] = useState<Escrow[]>([])
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [selectedEscrow, setSelectedEscrow] = useState<Escrow | null>(null)
  const [newEscrow, setNewEscrow] = useState({
    payer: "",
    payee: "",
    totalAmount: "",
    deadlineInDays: "",
    stepAmounts: "",
  })
  const [fundEscrowId, setFundEscrowId] = useState("")
  const [approveStepData, setApproveStepData] = useState({ escrowId: "", stepIndex: "" })
  const [releaseFundsId, setReleaseFundsId] = useState("")
  const [withdrawFundsId, setWithdrawFundsId] = useState("")
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    const initWeb3 = async () => {
      if ((window as any).ethereum) {
        const web3Instance = new Web3((window as any).ethereum)
        try {
          await (window as any).ethereum.request({ method: "eth_requestAccounts" })
          const accounts = await web3Instance.eth.getAccounts()
          setAccount(accounts[0])
          setWeb3(web3Instance)
          const contractInstance = new web3Instance.eth.Contract(contractABI, contractAddress)
          setContract(contractInstance)
        } catch (error) {
          console.error("User denied account access", error)
          setNotification({ type: "error", message: "Failed to connect to MetaMask. Please try again." })
        }
      } else {
        console.log("Non-Ethereum browser detected. You should consider trying MetaMask!")
        setNotification({ type: "error", message: "Non-Ethereum browser detected. Please install MetaMask." })
      }
    }

    initWeb3()
  }, [])

  useEffect(() => {
    if (contract) {
      fetchEscrows()
    }
  }, [contract])

  const fetchEscrowSteps = async (escrowId: number) => {
    if (!contract || !web3) return []
    try {
      const result = await contract.methods.getEscrowSteps(escrowId).call()
      const amounts = result[0]
      const approvals = result[1]

      return amounts.map((amount: string, index: number) => ({
        amount: web3.utils.fromWei(amount, "ether"),
        approved: approvals[index],
      }))
    } catch (error) {
      console.error(`Error fetching steps for escrow ${escrowId}:`, error)
      return []
    }
  }

  const handleEscrowClick = async (escrow: Escrow) => {
    const steps = await fetchEscrowSteps(escrow.id)
    setSelectedEscrow({ ...escrow, steps })
  }

  const fetchEscrows = async () => {
    if (!contract || !web3) return
    setLoading(true)
    try {
      const escrowCount = await contract.methods.escrowCount().call()
      const fetchedEscrows = []

      for (let i = 0; i < Number(escrowCount); i++) {
        try {
          const escrow = await contract.methods.escrows(i).call()
          const steps = await fetchEscrowSteps(i)
          fetchedEscrows.push({
            id: i,
            payer: escrow.payer,
            payee: escrow.payee,
            totalAmount: escrow.totalAmount.toString(),
            deadline: Number(escrow.deadline),
            isActive: escrow.isActive,
            completed: escrow.completed,
            releasedAmount: escrow.releasedAmount.toString(),
            steps: steps,
          })
        } catch (error) {
          console.error(`Error fetching escrow ${i}:`, error)
        }
      }

      setEscrows(fetchedEscrows)
    } catch (error) {
      console.error("Error fetching escrows:", error)
      setNotification({ type: "error", message: "Failed to fetch escrows. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateEscrow = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contract || !account || !web3) return

    setLoading(true)
    try {
      const { payer, payee, totalAmount, deadlineInDays, stepAmounts } = newEscrow
      const stepAmountsArray = stepAmounts.split(",").map((amount) => web3.utils.toWei(amount.trim(), "ether"))

      const gasEstimate = await contract.methods.createEscrow(payer, payee, web3.utils.toWei(totalAmount, "ether"), deadlineInDays, stepAmountsArray).estimateGas({ from: account })

      await contract.methods.createEscrow(payer, payee, web3.utils.toWei(totalAmount, "ether"), deadlineInDays, stepAmountsArray).send({ from: account, gas: gasEstimate })

      setNotification({ type: "success", message: "Escrow created successfully" })
      fetchEscrows()
      setNewEscrow({ payer: "", payee: "", totalAmount: "", deadlineInDays: "", stepAmounts: "" })
    } catch (error) {
      console.error("Error creating escrow:", error)
      setNotification({ type: "error", message: "Error creating escrow. Please check your inputs and try again." })
    } finally {
      setLoading(false)
    }
  }

  const handleFundEscrow = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contract || !account || !web3) return

    setLoading(true)
    try {
      const escrow = escrows.find((e) => e.id === parseInt(fundEscrowId))
      if (!escrow) throw new Error("Escrow not found")

      const gasEstimate = await contract.methods.fundEscrow(fundEscrowId).estimateGas({
        from: account,
        value: escrow.totalAmount,
      })

      await contract.methods.fundEscrow(fundEscrowId).send({
        from: account,
        value: escrow.totalAmount,
        gas: gasEstimate,
      })

      setNotification({ type: "success", message: "Escrow funded successfully" })
      fetchEscrows()
      setFundEscrowId("")
    } catch (error) {
      console.error("Error funding escrow:", error)
      setNotification({ type: "error", message: "Error funding escrow. Please check your inputs and try again." })
    } finally {
      setLoading(false)
    }
  }

  const handleApproveStep = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contract || !account) return

    setLoading(true)
    try {
      const gasEstimate = await contract.methods.approveStep(approveStepData.escrowId, approveStepData.stepIndex).estimateGas({ from: account })

      await contract.methods.approveStep(approveStepData.escrowId, approveStepData.stepIndex).send({ from: account, gas: gasEstimate })
      setNotification({ type: "success", message: "Step approved successfully" })
      fetchEscrows()
      setApproveStepData({ escrowId: "", stepIndex: "" })
    } catch (error) {
      console.error("Error approving step:", error)
      setNotification({ type: "error", message: "Error approving step. Please check your inputs and try again." })
    } finally {
      setLoading(false)
    }
  }

  const handleReleaseFunds = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contract || !account) return

    setLoading(true)
    try {
      const gasEstimate = await contract.methods.releaseFunds(releaseFundsId).estimateGas({ from: account })

      await contract.methods.releaseFunds(releaseFundsId).send({ from: account, gas: gasEstimate })
      setNotification({ type: "success", message: "Funds released successfully" })
      fetchEscrows()
      setReleaseFundsId("")
    } catch (error) {
      console.error("Error releasing funds:", error)
      setNotification({ type: "error", message: "Error releasing funds. Please check your inputs and try again." })
    } finally {
      setLoading(false)
    }
  }

  const handleWithdrawFunds = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contract || !account) return

    setLoading(true)
    try {
      const gasEstimate = await contract.methods.withdrawFunds(withdrawFundsId).estimateGas({ from: account })

      await contract.methods.withdrawFunds(withdrawFundsId).send({ from: account, gas: gasEstimate })
      setNotification({ type: "success", message: "Funds withdrawn successfully" })
      fetchEscrows()
      setWithdrawFundsId("")
    } catch (error) {
      console.error("Error withdrawing funds:", error)
      setNotification({ type: "error", message: "Error withdrawing funds. Please check your inputs and try again." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Escrow Factory
          </Typography>
          {web3 && contract ? (
            <>
              <Typography variant="subtitle1" gutterBottom>
                Connected Account: {account}
              </Typography>

              <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
                <Tab label="Create Escrow" />
                <Tab label="Manage Escrows" />
                <Tab label="View Escrows" />
              </Tabs>

              {activeTab === 0 && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Create Escrow
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField label="Payer Address" value={newEscrow.payer} onChange={(e) => setNewEscrow({ ...newEscrow, payer: e.target.value })} fullWidth margin="normal" />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField label="Payee Address" value={newEscrow.payee} onChange={(e) => setNewEscrow({ ...newEscrow, payee: e.target.value })} fullWidth margin="normal" />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField label="Total Amount (ETH)" value={newEscrow.totalAmount} onChange={(e) => setNewEscrow({ ...newEscrow, totalAmount: e.target.value })} fullWidth margin="normal" />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField label="Deadline (days)" value={newEscrow.deadlineInDays} onChange={(e) => setNewEscrow({ ...newEscrow, deadlineInDays: e.target.value })} fullWidth margin="normal" />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField label="Step Amounts (comma-separated ETH values)" value={newEscrow.stepAmounts} onChange={(e) => setNewEscrow({ ...newEscrow, stepAmounts: e.target.value })} fullWidth margin="normal" />
                      </Grid>
                    </Grid>
                  </CardContent>
                  <CardActions>
                    <Button onClick={handleCreateEscrow} variant="contained" color="primary" disabled={loading} fullWidth>
                      {loading ? <CircularProgress size={24} /> : "Create Escrow"}
                    </Button>
                  </CardActions>
                </Card>
              )}

              {activeTab === 1 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Fund Escrow
                        </Typography>
                        <TextField label="Escrow ID" value={fundEscrowId} onChange={(e) => setFundEscrowId(e.target.value)} fullWidth margin="normal" />
                      </CardContent>
                      <CardActions>
                        <Button onClick={handleFundEscrow} variant="contained" color="primary" disabled={loading} fullWidth>
                          {loading ? <CircularProgress size={24} /> : "Fund Escrow"}
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Approve Step
                        </Typography>
                        <TextField label="Escrow ID" value={approveStepData.escrowId} onChange={(e) => setApproveStepData({ ...approveStepData, escrowId: e.target.value })} fullWidth margin="normal" />
                        <TextField label="Step Index" value={approveStepData.stepIndex} onChange={(e) => setApproveStepData({ ...approveStepData, stepIndex: e.target.value })} fullWidth margin="normal" />
                      </CardContent>
                      <CardActions>
                        <Button onClick={handleApproveStep} variant="contained" color="primary" disabled={loading} fullWidth>
                          {loading ? <CircularProgress size={24} /> : "Approve Step"}
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Release Funds
                        </Typography>
                        <TextField label="Escrow ID" value={releaseFundsId} onChange={(e) => setReleaseFundsId(e.target.value)} fullWidth margin="normal" />
                      </CardContent>
                      <CardActions>
                        <Button onClick={handleReleaseFunds} variant="contained" color="primary" disabled={loading} fullWidth>
                          {loading ? <CircularProgress size={24} /> : "Release Funds"}
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Withdraw Funds
                        </Typography>
                        <TextField label="Escrow ID" value={withdrawFundsId} onChange={(e) => setWithdrawFundsId(e.target.value)} fullWidth margin="normal" />
                      </CardContent>
                      <CardActions>
                        <Button onClick={handleWithdrawFunds} variant="contained" color="primary" disabled={loading} fullWidth>
                          {loading ? <CircularProgress size={24} /> : "Withdraw Funds"}
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                </Grid>
              )}

              {activeTab === 2 && (
                <Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                    <Typography variant="h6">Escrow List</Typography>
                    <Tooltip title="Refresh Escrow List">
                      <IconButton onClick={fetchEscrows} disabled={loading}>
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>ID</TableCell>
                          <TableCell>Payer</TableCell>
                          <TableCell>Payee</TableCell>
                          <TableCell>Total Amount (ETH)</TableCell>
                          <TableCell>Deadline</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Released Amount (ETH)</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {escrows.map((escrow) => (
                          <TableRow key={escrow.id}>
                            <TableCell>{escrow.id}</TableCell>
                            <TableCell>
                              {escrow.payer.slice(0, 6)}...{escrow.payer.slice(-4)}
                            </TableCell>
                            <TableCell>
                              {escrow.payee.slice(0, 6)}...{escrow.payee.slice(-4)}
                            </TableCell>
                            <TableCell>{web3!.utils.fromWei(escrow.totalAmount, "ether")}</TableCell>
                            <TableCell>{new Date(escrow.deadline * 1000).toLocaleString()}</TableCell>
                            <TableCell>{escrow.completed ? "Active" : escrow.isActive ? "Active" : "Inactive"}</TableCell>
                            <TableCell>{web3!.utils.fromWei(escrow.releasedAmount, "ether")}</TableCell>
                            <TableCell>
                              <Button onClick={() => handleEscrowClick(escrow)} size="small">
                                View Steps
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {selectedEscrow && (
                    <Accordion sx={{ mt: 2 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>Escrow Steps for ID: {selectedEscrow.id}</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Step</TableCell>
                              <TableCell>Amount (ETH)</TableCell>
                              <TableCell>Approved</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {selectedEscrow.steps && selectedEscrow.steps.length > 0 ? (
                              selectedEscrow.steps.map((step, index) => (
                                <TableRow key={index}>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell>{step.amount}</TableCell>
                                  <TableCell>{step.approved ? "Yes" : "No"}</TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={3}>No steps available for this escrow.</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </AccordionDetails>
                    </Accordion>
                  )}
                </Box>
              )}
            </>
          ) : (
            <Typography variant="body1">Loading Web3, accounts, and contract...</Typography>
          )}
        </Box>
      </Container>
      <Snackbar open={!!notification} autoHideDuration={6000} onClose={() => setNotification(null)}>
        <Alert onClose={() => setNotification(null)} severity={notification?.type} sx={{ width: "100%" }}>
          {notification?.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  )
}

export default App
