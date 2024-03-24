export type RandomNumberRequestStateValue =
  | {
      error: string;
      status: "error";
      timestamp: number;
    }
  | {
      data: string;
      status: "success";
      timestamp: number;
    }
  | {
      status: "pending";
      timestamp: number;
    };
